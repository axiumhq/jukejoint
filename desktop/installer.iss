#ifndef AppVersion
  #define AppVersion "0.0.0"
#endif

[Setup]
AppId={{A782DD98-8ED2-4CF5-A9D8-278C6C442B77}
AppName=Jukejoint
AppVersion={#AppVersion}
AppVerName=Jukejoint {#AppVersion}
AppPublisher=Axium
DefaultDirName={localappdata}\Programs\Jukejoint
DefaultGroupName=Jukejoint
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=out
OutputBaseFilename=Jukejoint-v{#AppVersion}-windows-x64-setup
UninstallDisplayIcon={app}\Jukejoint.exe
WizardStyle=modern
Compression=lzma2
SolidCompression=yes
CloseApplications=yes

[Files]
Source: "out\Jukejoint\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\Jukejoint"; Filename: "{app}\Jukejoint.exe"
Name: "{autodesktop}\Jukejoint"; Filename: "{app}\Jukejoint.exe"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "Criar atalho na área de trabalho"; Flags: unchecked

[Run]
Filename: "{app}\Jukejoint.exe"; Description: "Abrir Jukejoint"; Flags: nowait postinstall skipifsilent
