# Maintainer: Aeeryin <artisticamente.official@gmail.com>
pkgname=printcat
pkgver=1.3.2
pkgrel=1
pkgdesc="Premium, feature-rich cross-platform screenshot tool"
arch=('x86_64')
url="https://github.com/aeeryin/Printcat"
license=('MIT')
depends=('electron' 'libnotify' 'libxtst' 'nss' 'libxss' 'libappindicator-gtk3' 'libsecret')
makedepends=('tar' 'squashfs-tools' 'patchelf')
options=(!strip)
source=("${url}/releases/download/v${pkgver}/Printcat-${pkgver}-linux.tar.xz")
sha256sums=('SKIP')

package() {
    cd "${srcdir}"

    # Create directory structure
    install -dm755 "${pkgdir}/opt/${pkgname}"
    tar xf "Printcat-${pkgver}-linux.tar.xz" -C "${pkgdir}/opt/${pkgname}" --strip-components=0

    # Create symlink in /usr/bin
    install -dm755 "${pkgdir}/usr/bin"
    ln -s "/opt/${pkgname}/${pkgname}" "${pkgdir}/usr/bin/${pkgname}"

    # Desktop file
    install -Dm644 "${pkgdir}/opt/${pkgname}/${pkgname}.desktop" \
        "${pkgdir}/usr/share/applications/${pkgname}.desktop" 2>/dev/null || true

    # Icon
    install -Dm644 "${pkgdir}/opt/${pkgname}/resources/app/src/assets/icons/main.png" \
        "${pkgdir}/usr/share/pixmaps/${pkgname}.png" 2>/dev/null || true

    # Fix permissions
    chmod -R 755 "${pkgdir}/opt/${pkgname}"
}
