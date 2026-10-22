#
# Copyright (C) 2026 luci-app-tor-ext contributors
#
# This is free software, licensed under the GNU General Public License v3.
#

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-tor-ext
PKG_VERSION:=1.0.0
PKG_RELEASE:=1
PKG_LICENSE:=GPL-3.0-or-later
PKG_MAINTAINER:=luci-app-tor-ext contributors
PKG_ARCH:=all

LUCI_TITLE:=Tor — управление Tor, мостами и прозрачным проксированием
LUCI_DESCRIPTION:=Расширенное приложение LuCI для управления установленным Tor: \
	статус и мониторинг, редактор torrc с проверкой и резервными копиями, \
	мосты (obfs4, snowflake, meek, webtunnel) с изолированной проверкой, \
	порты и скрытые сервисы (.onion), прозрачное проксирование через nftables, \
	журналы, сторожевой таймер и уведомления.
LUCI_DEPENDS:=+luci-base +rpcd-mod-ucode +tor +curl +nftables
LUCI_PKGARCH:=all

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
