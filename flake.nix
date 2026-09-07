{
  description = "TUI dashboard for monitoring and managing OpenCode sessions";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

    bun2nix = {
      url = "github:nix-community/bun2nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    {
      self,
      nixpkgs,
      bun2nix,
    }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
      ];
      forAllSystems = nixpkgs.lib.genAttrs systems;
      pkgsFor =
        system:
        import nixpkgs {
          inherit system;
          overlays = [ bun2nix.overlays.default ];
        };
      packageFor =
        system:
        (pkgsFor system).callPackage ./package.nix {
          src = self;
        };
    in
    {
      packages = forAllSystems (system: {
        default = packageFor system;
        opencode-monitor = packageFor system;
      });

      apps = forAllSystems (system: {
        default = {
          type = "app";
          program = "${self.packages.${system}.default}/bin/opencode-monitor";
          meta.description = "Run OpenCode Monitor";
        };
      });

      checks = forAllSystems (system: {
        default = packageFor system;
      });

      devShells = forAllSystems (
        system:
        let
          pkgs = pkgsFor system;
        in
        {
          default = pkgs.mkShell {
            packages = [
              pkgs.bun
              pkgs.bun2nix
              (packageFor system)
            ];
          };
        }
      );
    };
}
