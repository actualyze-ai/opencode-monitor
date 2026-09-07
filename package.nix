{
  bun,
  bun2nix,
  lib,
  libnotify,
  makeWrapper,
  src,
  stdenv,
  xdg-utils,
}:

let
  package = builtins.fromJSON (builtins.readFile ./package.json);
  runtimePath = [
    libnotify
    xdg-utils
  ];
in
stdenv.mkDerivation {
  pname = "opencode-monitor";
  inherit (package) version;

  inherit src;

  nativeBuildInputs = [
    bun2nix.hook
    makeWrapper
  ];

  bunDeps = bun2nix.fetchBunDeps {
    bunNix = ./bun.nix;
  };

  dontRunLifecycleScripts = true;

  buildPhase = ''
    runHook preBuild
    bun run build
    runHook postBuild
  '';

  installPhase = ''
    runHook preInstall

    appDir="$out/lib/opencode-monitor"
    mkdir -p "$appDir" "$out/bin"
    cp -R dist node_modules opencode "$appDir/"

    makeWrapper ${bun}/bin/bun "$out/bin/opencode-monitor" \
      --add-flags "$appDir/dist/opencode-monitor.mjs" \
      --prefix PATH : ${lib.makeBinPath runtimePath}
    ln -s opencode-monitor "$out/bin/oc-mon"

    runHook postInstall
  '';

  meta = {
    description = package.description;
    homepage = "https://github.com/actualyze-ai/opencode-monitor";
    license = lib.licenses.mit;
    mainProgram = "opencode-monitor";
    platforms = lib.platforms.linux;
  };
}
