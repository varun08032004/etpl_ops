; Complete custom NSIS script for EtherTrack Agent installer
; No MUI - custom pages to avoid language table warnings
; Uses constants passed by electron-builder as command-line defines

!include LogicLib.nsh
!include FileFunc.nsh
!include WinMessages.nsh
!include x64.nsh
!include Sections.nsh
!include nsDialogs.nsh

; Icon
Icon "${MUI_ICON}"
UninstallIcon "${MUI_UNICON}"

; General settings
Name "${PRODUCT_NAME}"
OutFile "${PROJECT_DIR}\dist\${PRODUCT_FILENAME} Setup ${VERSION}.exe"
InstallDir "$PROGRAMFILES64\${PRODUCT_NAME}"
InstallDirRegKey HKLM "${UNINSTALL_APP_KEY}" "InstallLocation"
RequestExecutionLevel admin
ShowInstDetails show

; Pages
Page directory
Page instfiles

UninstPage uninstConfirm
UninstPage instfiles

; Language (English only)
LoadLanguageFile "${NSISDIR}\Contrib\Language files\English.nlf"
LangString NAME ${LANG_ENGLISH} "${PRODUCT_NAME}"
LangString SETUP_CAPTION ${LANG_ENGLISH} "${PRODUCT_NAME} Setup"
LangString UNINSTALL_CAPTION ${LANG_ENGLISH} "${PRODUCT_NAME} Uninstall"
LangString COMPLETED ${LANG_ENGLISH} "Completed"
LangString LICENSE_TEXT ${LANG_ENGLISH} "License Agreement"
LangString LICENSE_SUBTEXT ${LANG_ENGLISH} "Please review the license terms before installing ${PRODUCT_NAME}."
LangString CLICK_NEXT ${LANG_ENGLISH} "Click Next to continue."
LangString CLICK_INSTALL ${LANG_ENGLISH} "Click Install to start the installation."
LangString CLICK_UNINSTALL ${LANG_ENGLISH} "Click Uninstall to start the uninstallation."
LangString INSTALLATION_COMPLETE ${LANG_ENGLISH} "Installation completed successfully."
LangString UNINSTALLATION_COMPLETE ${LANG_ENGLISH} "Uninstallation completed successfully."

; Custom function to close existing agent
Function ET_CloseAgent
  nsExec::Exec 'powershell -Command "Get-Process -Name \'EtherTrack Agent\' -ErrorAction SilentlyContinue | Stop-Process -Force"'
FunctionEnd

; Override .onInit to close existing agent BEFORE default checks
Function .onInit
  Call ET_CloseAgent
FunctionEnd

; Installer sections
Section "Install" SEC_INSTALL
  SetOutPath "$INSTDIR"
  
  ; Files are added by electron-builder via File /r command at build time
  
  ; Create uninstaller
  WriteUninstaller "$INSTDIR\uninstall.exe"
  
  ; Registry entries for uninstall
  WriteRegStr HKLM "${UNINSTALL_APP_KEY}" "DisplayName" "${PRODUCT_NAME}"
  WriteRegStr HKLM "${UNINSTALL_APP_KEY}" "UninstallString" "$INSTDIR\uninstall.exe"
  WriteRegStr HKLM "${UNINSTALL_APP_KEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKLM "${UNINSTALL_APP_KEY}" "Publisher" "${COMPANY_NAME}"
  WriteRegStr HKLM "${UNINSTALL_APP_KEY}" "InstallLocation" "$INSTDIR"
  
  ; Start menu shortcuts
  CreateDirectory "$SMPROGRAMS\${PRODUCT_NAME}"
  CreateShortcut "$SMPROGRAMS\${PRODUCT_NAME}\${PRODUCT_NAME}.lnk" "$INSTDIR\${PRODUCT_FILENAME}.exe"
  CreateShortcut "$SMPROGRAMS\${PRODUCT_NAME}\Uninstall.lnk" "$INSTDIR\uninstall.exe"
  
  ; Desktop shortcut
  CreateShortcut "$DESKTOP\${PRODUCT_NAME}.lnk" "$INSTDIR\${PRODUCT_FILENAME}.exe"
SectionEnd

; Uninstaller section
Section "Uninstall" SEC_UNINSTALL
  ; Close running agent before uninstall
  IfFileExists "$INSTDIR\${PRODUCT_FILENAME}.exe" 0 +2
  ExecWait '"$INSTDIR\${PRODUCT_FILENAME}.exe" --force-close'
  
  Delete "$INSTDIR\uninstall.exe"
  Delete "$INSTDIR\${PRODUCT_FILENAME}.exe"
  Delete "$INSTDIR\resources\app.asar"
  RMDir /r "$INSTDIR\resources"
  RMDir /r "$INSTDIR\locales"
  RMDir /r "$INSTDIR\swiftshader"
  Delete "$INSTDIR\d3dcompiler_47.dll"
  Delete "$INSTDIR\libEGL.dll"
  Delete "$INSTDIR\libGLESv2.dll"
  Delete "$INSTDIR\vulkan-1.dll"
  Delete "$INSTDIR\chrome_elf.dll"
  Delete "$INSTDIR\libvk_swiftshader.dll"
  Delete "$INSTDIR\libvulkan.dll"
  Delete "$INSTDIR\vk_swiftshader_icd.json"
  Delete "$INSTDIR\uninstall.exe"
  
  RMDir "$INSTDIR"
  
  ; Remove registry keys
  DeleteRegKey HKLM "${UNINSTALL_APP_KEY}"
  
  ; Remove shortcuts
  Delete "$SMPROGRAMS\${PRODUCT_NAME}\${PRODUCT_NAME}.lnk"
  Delete "$SMPROGRAMS\${PRODUCT_NAME}\Uninstall.lnk"
  RMDir "$SMPROGRAMS\${PRODUCT_NAME}"
  Delete "$DESKTOP\${PRODUCT_NAME}.lnk"
SectionEnd

; Describe sections (removed - requires MUI.nsh)