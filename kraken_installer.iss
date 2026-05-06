[Setup]
AppId={{9ED45F45-C9A8-417A-8A46-24CB842A2F11}
AppName=Kraken Media Server
AppVerName=Kraken Media Server 4.95
AppVersion=4.95
AppPublisher=Kraken Systems
AppComments=Servidor multimedia local con modo online/offline
AppPublisherURL=https://github.com/arsdaemonia-design/kraken-media-server
AppSupportURL=https://github.com/arsdaemonia-design/kraken-media-server
AppUpdatesURL=https://github.com/arsdaemonia-design/kraken-media-server/releases
UninstallDisplayName=Kraken Media Server
DefaultDirName={localappdata}\Kraken Media Server
PrivilegesRequired=lowest
DisableProgramGroupPage=yes
OutputDir=dist
OutputBaseFilename=Kraken_Media_Server_Installer_v4.95
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
SetupIconFile=assets\kraken-512-setup.ico
WizardImageFile=assets\wizard_large.bmp
WizardSmallImageFile=assets\wizard_small.bmp

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:DesktopIconTask}"; GroupDescription: "{cm:AdditionalIconsGroup}"; Flags: unchecked

[Files]
Source: "dist\KrakenOffline\KrakenOffline.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "dist\KrakenOffline\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\Kraken Media Server"; Filename: "{app}\KrakenOffline.exe"
Name: "{autodesktop}\Kraken Media Server"; Filename: "{app}\KrakenOffline.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\KrakenOffline.exe"; Description: "{cm:LaunchAfterInstall}"; Flags: nowait postinstall skipifsilent

[CustomMessages]
spanish.AdditionalIconsGroup=Accesos directos
spanish.DesktopIconTask=Crear acceso directo en el escritorio
spanish.LaunchAfterInstall=Iniciar Kraken Media Server ahora
