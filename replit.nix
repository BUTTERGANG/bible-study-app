{ pkgs }: {
  deps = [
    pkgs.gitleaks
    pkgs.python311
    pkgs.python311Packages.pip
    pkgs.nodejs_20
    pkgs.nodePackages.npm
  ];
}
