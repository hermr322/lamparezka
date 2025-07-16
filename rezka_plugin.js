(function () {
    'use strict';

    /**
     * Эта функция будет вызвана, когда пользователь выберет наш источник
     * @param {object} movie_data - Информация о фильме от Lampa
     */
    function runSearchAndPlay(movie_data) {
        Lampa.Noty.show('Ищем на Rezka...');
        
        let search_url = 'https://cors.movian.tv/https://rezka.fi/search/?do=search&subaction=search&q=' + encodeURIComponent(movie_data.title);
        
        Lampa.Request.get(search_url, function(data) {
            let doc = new DOMParser().parseFromString(data, "text/html");
            let firstResult = doc.querySelector('.b-content__inline_item .b-content__inline_item-link a');
            
            if(firstResult && firstResult.href) {
                showEpisodeSelection(firstResult.href, movie_data.title);
            } else {
                Lampa.Noty.show('Не найдено на Rezka по названию: ' + movie_data.title);
            }
        }, (err) => {
            Lampa.Noty.show('Ошибка поиска на Rezka.');
        });
    }


    /**
     * Главная функция инициализации плагина
     */
    function startPlugin() {
        // Создаем компонент, который будет запускаться при выборе нашего источника
        Lampa.Component.add('rezka_component', {
            // Этот компонент невидим, он просто служит точкой входа для нашей логики
            cubac: 'lampa',
            // При старте компонента Lampa передает в него информацию о фильме
            onrender: function (movie_data) {
                runSearchAndPlay(movie_data);
            }
        });

        // Создаем манифест, который описывает наш плагин для Lampa
        var manifest = {
            type: 'video',
            version: '7.0.0',
            name: 'Rezka Online', // Это имя будет в списке источников
            description: 'Поиск и просмотр с сайта Rezka',
            component: 'rezka_component' // Указываем, какой компонент запустить
        };

        // Регистрируем наш плагин в Lampa как источник
        Lampa.Manifest.plugins = manifest;
    }

    // Все наши вспомогательные функции остаются без изменений

    function showEpisodeSelection(movie_url, movie_title) {
        Lampa.Utils.putScriptAsync([], () => {});
        var proxy_movie_url = 'https://cors.movian.tv/' + movie_url;
        Lampa.Request.get(proxy_movie_url, function (html_data) {
            var doc = new DOMParser().parseFromString(html_data, "text/html");
            var post_id = html_data.match(/sof\.tv\.initCDNSeriesEvents\((\d+),/)?.[1];
            var favs_token = doc.querySelector('#ctrl_favs')?.value;
            if (!post_id || !favs_token) return Lampa.Noty.show('Не удалось найти ID контента на странице Rezka.');
            var initial_translator_id = html_data.match(/sof\.tv\.initCDNSeriesEvents\(\d+,\s*(\d+),/)?.[1];
            var translators = Array.from(doc.querySelectorAll('#translators-list > .b-translator__item')).map(t => ({title: t.textContent.trim(), translator_id: t.dataset.translator_id, selected: t.dataset.translator_id === initial_translator_id}));
            var seasons = Array.from(doc.querySelectorAll('#simple-seasons-tabs > li')).map(s => ({title: s.textContent.trim(), season: s.dataset.tab_id, selected: s.classList.contains('active')}));
            if (!translators.length) return Lampa.Noty.show('Не удалось найти список озвучек.');
            function selectTranslator() { Lampa.Select.show({title: 'Озвучка', items: translators, onSelect: t => selectSeason(t.translator_id), onBack: () => Lampa.Controller.toggle('full')}); }
            function selectSeason(translator_id) { Lampa.Select.show({title: 'Сезон', items: seasons, onSelect: s => { var episodes = Array.from(doc.querySelectorAll(`#simple-episodes-list-${s.season} > li`)).map(e => ({title: e.textContent.trim(), episode: e.dataset.episode_id, selected: e.classList.contains('active')})); selectEpisode(translator_id, s.season, episodes); }, onBack: selectTranslator});}
            function selectEpisode(translator_id, season, episodes) { Lampa.Select.show({title: 'Серия', items: episodes, onSelect: e => { let params = {id: post_id, translator_id, season, episode: e.episode, favs: favs_token, action: 'get_stream', title: movie_title}; getStreamsAndPlay(params); }, onBack: () => selectSeason(translator_id)}); }
            selectTranslator();
        }, (err) => Lampa.Noty.show('Ошибка загрузки страницы с Rezka.'));
    }
    function getStreamsAndPlay(params) {
        var url = 'https://cors.movian.tv/https://rezka.fi/ajax/get_cdn_series/';
        Lampa.Request.post(url, params, data => {
            if (data.success && data.streams) playFromStreams(data.streams, params.title, params.season, params.episode);
            else Lampa.Noty.show(data.message || 'Сервер не вернул данные о потоке.');
        }, () => Lampa.Noty.show('Сетевая ошибка при запросе серии.'));
    }
    function playFromStreams(encodedStreams, title, season, episode) {
        try {
            var cleanedStreams = encodedStreams.replace('#h', '').replace(/\/\/\_\/\//g, '').replace(/[!@#$%^]/g, '');
            var decodedStreams = atob(cleanedStreams);
            var streams = {};
            decodedStreams.split(',').forEach(stream => {
                var parts = stream.split(']');
                if (parts.length > 1) {
                    var quality = parts[0].replace('[', '').trim();
                    var url = parts[1];
                    if (url && url.includes('.m3u8')) streams[quality] = url.split(' or ')[0];
                }
            });
            var stream_url = streams['1080p Ultra'] || streams['1080p'] || streams['720p'] || streams['480p'] || Object.values(streams)[0];
            if (stream_url) {
                Lampa.Player.play({url: stream_url, title: `${title} | С${season} Е${episode}`});
                Lampa.Player.open();
            } else Lampa.Noty.show('Подходящий видеопоток не найден.');
        } catch (e) {Lampa.Noty.show('Ошибка декодирования потоков.');}
    }

    // Ждем полной загрузки Lampa
    document.addEventListener('lampa:ready', startPlugin, false);

})();