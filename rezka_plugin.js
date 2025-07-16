(function () {
    'use strict';

    const proxyHost = 'https://your-proxy.example.com/'; // <-- замени на свой прокси

    function startPlugin() {
        if (window.rezka_plugin) return;
        window.rezka_plugin = true;

        Lampa.Component.add('rezka_content', {
            cubac: 'lampa',
            onrender(obj) {
                const url = obj.options.url || 'https://rezka.ag/';
                obj.empty();
                loadList(obj, url);
            }
        });

        Lampa.Menu.add({
            title: 'Rezka (без рекламы)',
            icon: '<svg viewBox="0 0 512 512" fill="currentColor"><path d="M448 64H64..."/></svg>',
            component: 'rezka_content'
        });

        Lampa.Listener.follow('search', e => {
            if (e.type == 'start') {
                const q = encodeURIComponent(Lampa.Search.value() || '');
                Lampa.Search.add({
                    title: 'Искать на Rezka',
                    component: 'rezka_content',
                    url: `https://rezka.ag/search/?do=search&subaction=search&q=${q}`
                });
            }
        });
    }

    function loadList(container, url) {
        Lampa.Noty.show('Загрузка...');
        Lampa.Request.get(proxyHost + url, html => {
            const doc = new DOMParser().parseFromString(html, 'text/html');
            const items = doc.querySelectorAll('.b-content__inline_item, .b-simple_content__item');
            const list = [];

            items.forEach(it => {
                const a = it.querySelector('a[href*="/film/"], a[href*="/series/"], a[href*="/cartoon/"]');
                const img = it.querySelector('img');
                const info = it.querySelector('.info, .genre, .year')?.textContent.trim() || '';
                if (a && img) list.push({ name: a.textContent.trim(), url: a.href, poster: img.src, info });
            });

            const scroll = Lampa.Component.createScroll('Rezka — результаты', list, (item, key, empty) => {
                const card = Lampa.Template.get('card', { title: item.name, poster: item.poster, info: item.info });
                card.on('hover:enter', () => showSelectors(item));
                empty.append(card);
            });

            container.append(scroll);
            Lampa.Controller.toggle('content');
        }, () => Lampa.Noty.show('Ошибка загрузки списка'));
    }

    function showSelectors(item) {
        Lampa.Noty.show('Загрузка страницы...');
        Lampa.Request.get(proxyHost + item.url, html => {
            const doc = new DOMParser().parseFromString(html, 'text/html');
            const post = html.match(/initCDNSeriesEvents\((\d+),/)[1];
            const favs = html.match(/data-token="(.+?)"/)[1];
            const trans = Array.from(doc.querySelectorAll('.b-translator__item')).map(t => ({
                title: t.textContent.trim(),
                id: t.dataset.translator_id
            }));
            const seas = Array.from(doc.querySelectorAll('.b-simple_season__item')).map(s => ({
                title: s.textContent.trim(),
                id: s.dataset.tab_id
            }));

            if (!post || !favs || trans.length === 0 || seas.length === 0) 
                return Lampa.Noty.show('Данные не найдены');

            selectTranslator({ item, post, favs, trans, seas });
        }, () => Lampa.Noty.show('Ошибка страницы'));
    }

    function selectTranslator(ctx) {
        Lampa.Select.show({
            title: 'Выбери озвучку',
            items: ctx.trans.map(t => ({ title: t.title, params: t })),
            onSelect: sel => selectSeason(Object.assign({}, ctx, { translator_id: sel.params.id })),
            onBack: () => Lampa.Controller.toggle('content')
        });
    }

    function selectSeason(ctx) {
        Lampa.Select.show({
            title: 'Выбери сезон',
            items: ctx.seas.map(s => ({ title: s.title, params: s })),
            onSelect: sel => selectEpisode(Object.assign({}, ctx, { season_id: sel.params.id })),
            onBack: () => selectTranslator(ctx)
        });
    }

    function selectEpisode(ctx) {
        const url = `${ctx.item.url}?ajax=1&show=series&season=${ctx.season_id}`;
        Lampa.Request.get(proxyHost + url, html => {
            const doc = new DOMParser().parseFromString(html, 'text/html');
            const eps = Array.from(doc.querySelectorAll('li[data-episode-id]')).map(e => ({
                title: e.textContent.trim(),
                id: e.dataset.episodeId
            }));
            Lampa.Select.show({
                title: 'Выбери серию',
                items: eps.map(e => ({ title: e.title, params: e })),
                onSelect: sel => getStreams({
                    post: ctx.post, favs: ctx.favs,
                    translator: ctx.translator_id,
                    season: ctx.season_id,
                    episode: sel.params.id,
                    title: ctx.item.name
                }),
                onBack: () => selectSeason(ctx)
            });
        }, () => Lampa.Noty.show('Ошибка загрузки эпизодов'));
    }

    function getStreams(opts) {
        const data = {
            id: opts.post,
            translator_id: opts.translator,
            season: opts.season,
            episode: opts.episode,
            favs: opts.favs,
            action: 'get_stream'
        };
        Lampa.Request.post(proxyHost + 'https://rezka.ag/ajax/get_cdn_series/', data, resp => {
            if (!resp.success) return Lampa.Noty.show('Нет потоков');
            const streams = decode(resp.streams);
            const url = streams['1080p Ultra'] || streams['1080p'] || streams['720p'] || Object.values(streams)[0];
            if (!url) return Lampa.Noty.show('Поток не найден');
            Lampa.Player.play({ url, title: `${opts.title} С${opts.season}E${opts.episode}` });
            Lampa.Player.open();
        }, () => Lampa.Noty.show('Ошибка получения потока'));
    }

    function decode(enc) {
        const str = atob(enc.replace('#h', ''));
        return str.split(',').reduce((acc, part) => {
            const [q, u] = part.split(']');
            if (q && u) acc[q.replace('[','').trim()] = u.trim();
            return acc;
        }, {});
    }

    document.addEventListener('lampa:ready', startPlugin);
})();
