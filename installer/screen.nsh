; One-click NSIS installation keeps electron-updater compatibility while this
; show callback replaces the stock progress dialog with Printcat's own panel.
!ifndef BUILD_UNINSTALLER
  !define MUI_PAGE_CUSTOMFUNCTION_SHOW PrintcatInstallShow
  !define MUI_INSTFILESPAGE_PROGRESSBAR colored
  !define MUI_INSTALLCOLORS "2675FF 313946"

  Var PrintcatBitmap
  Var PrintcatTitleFont
  Var PrintcatBodyFont

  !macro customHeader
    LangString PrintcatInstallTitle ${LANG_ENGLISH} "Installing Printcat"
    LangString PrintcatInstallTitle ${LANG_PORTUGUESEBR} "Instalando Printcat"
    LangString PrintcatInstallBody ${LANG_ENGLISH} "Preparing your app. This will only take a moment."
    LangString PrintcatInstallBody ${LANG_PORTUGUESEBR} "Preparando o aplicativo. Isso levará só um momento."
    LangString PrintcatInstallFoot ${LANG_ENGLISH} "Please wait while the installation finishes."
    LangString PrintcatInstallFoot ${LANG_PORTUGUESEBR} "Aguarde enquanto a instalação é concluída."
  !macroend

  !macro customInit
    InitPluginsDir
    SetOutPath $PLUGINSDIR
    File /oname=printcat-screen.bmp "${PROJECT_DIR}\installer\screen.bmp"
  !macroend

  Function PrintcatInstallShow
    ; The stock progress control continues to receive real NSIS progress.
    FindWindow $0 "#32770" "" $HWNDPARENT
    StrCmp $0 0 done
    GetDlgItem $1 $0 1004
    StrCmp $1 0 done

    System::Call 'user32::GetWindowLongW(p $HWNDPARENT, i -16) i .r2'
    IntOp $2 $2 & 0xFF3BFFFF
    System::Call 'user32::SetWindowLongW(p $HWNDPARENT, i -16, i r2) i'
    System::Call 'user32::GetSystemMetrics(i 0) i .r2'
    System::Call 'user32::GetSystemMetrics(i 1) i .r3'
    IntOp $2 $2 - 680
    IntOp $2 $2 / 2
    IntOp $3 $3 - 420
    IntOp $3 $3 / 2
    System::Call 'user32::SetWindowPos(p $HWNDPARENT, p 0, i r2, i r3, i 680, i 420, i 0x0020) i'
    System::Call 'gdi32::CreateRoundRectRgn(i 0, i 0, i 680, i 420, i 24, i 24) p .r2'
    System::Call 'user32::SetWindowRgn(p $HWNDPARENT, p r2, i 1) i'

    System::Call 'user32::LoadImageW(p 0, w "$PLUGINSDIR\printcat-screen.bmp", i 0, i 0, i 0, i 0x10) p .r2'
    StrCpy $PrintcatBitmap $2
    System::Call 'user32::CreateWindowExW(i 0, w "STATIC", w "", i 0x5000000E, i 0, i 0, i 680, i 420, p $HWNDPARENT, p 0, p 0, p 0) p .r3'
    SendMessage $3 0x0172 0 $PrintcatBitmap
    System::Call 'user32::SetWindowPos(p r3, p 1, i 0, i 0, i 0, i 0, i 0x0003) i'

    System::Call 'user32::SetParent(p r1, p $HWNDPARENT) p'
    System::Call 'user32::MoveWindow(p r1, i 44, i 315, i 592, i 16, i 1) i'
    System::Call 'uxtheme::SetWindowTheme(p r1, w "", w "") i'
    SendMessage $1 0x0409 0 0x00FF7526
    SendMessage $1 0x0401 0 0x00463931
    ShowWindow $0 0

    System::Call 'user32::CreateWindowExW(i 0, w "STATIC", w "$(PrintcatInstallTitle)", i 0x50000000, i 44, i 193, i 590, i 42, p $HWNDPARENT, p 0, p 0, p 0) p .r4'
    CreateFont $PrintcatTitleFont "Segoe UI" 24 600
    SendMessage $4 0x0030 $PrintcatTitleFont 1
    SetCtlColors $4 0xFFFFFF transparent

    System::Call 'user32::CreateWindowExW(i 0, w "STATIC", w "$(PrintcatInstallBody)", i 0x50000000, i 44, i 245, i 590, i 28, p $HWNDPARENT, p 0, p 0, p 0) p .r4'
    CreateFont $PrintcatBodyFont "Segoe UI" 11 400
    SendMessage $4 0x0030 $PrintcatBodyFont 1
    SetCtlColors $4 0xC4CCDB transparent

    System::Call 'user32::CreateWindowExW(i 0, w "STATIC", w "$(PrintcatInstallFoot)", i 0x50000000, i 44, i 345, i 590, i 24, p $HWNDPARENT, p 0, p 0, p 0) p .r4'
    SendMessage $4 0x0030 $PrintcatBodyFont 1
    SetCtlColors $4 0xA5B1C5 transparent
  done:
  FunctionEnd

  Function .onGUIEnd
    System::Call 'gdi32::DeleteObject(p $PrintcatBitmap) i'
    System::Call 'gdi32::DeleteObject(p $PrintcatTitleFont) i'
    System::Call 'gdi32::DeleteObject(p $PrintcatBodyFont) i'
  FunctionEnd
!endif
