(function () {
    'use strict';

    function startPlugin() {
        // Создаем самый простой манифест
        var manifest = {
            type: 'video',
            name: 'Rezka Test', // Имя, которое мы ищем в списке источников

            // Функция, которая сработает при нажатии на наш источник
            onContextLauch: function(movie_data) {
                // Просто покажем уведомление, что все сработало
                Lampa.Noty.show('Плагин Rezka Test сработал для: ' + movie_data.title);
            }
        };

        // Регистрируем плагин
        Lampa.Manifest.plugins = manifest;
        
        // Уведомление, что плагин попытался зарегистрироваться
        Lampa.Noty.show('Плагин Rezka Test загружен', {time: 5000});
    }

    // Ждем полной загрузки Lampa
    document.addEventListener('lampa:ready', startPlugin, false);

})();