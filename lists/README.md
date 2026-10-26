# Списки для раздельного туннелирования

Зеркало списков доменов и подсетей из [itdoginfo/allow-domains](https://github.com/itdoginfo/allow-domains)
(те же списки использует [podkop](https://github.com/itdoginfo/podkop), лицензия MIT).

Приложение тянет файлы отсюда:

    https://raw.githubusercontent.com/jeysson89/luci-app-tor-ext/main/lists/<имя>.lst

Свой домен или подсеть можно добавить в самом интерфейсе (раздел
«Раздельное туннелирование» → «Свои цели»).

- `russia_inside.lst` — сборный список «Россия» (1183 доменов)
- сервисы: YouTube, Meta, Twitter, Discord, Telegram и т.д. (189 доменов)
- категории: geoblock, block, news, anime, porn (1327 доменов)
- подсети IPv4 отдельных платформ (1235 подсетей)

Обновлять это зеркало: `python dev/mirror-lists.py`
