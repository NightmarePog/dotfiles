# Dotfiles

Desktop configuration based on a post-punk and Joy Division visual style.

Some configurations were adapted from [diinki](https://github.com/diinki).

The setup targets a dual-monitor workstation.

The configurations are stored here and linked into `~/.config`.

## installing

Preview the changes first:

```console
./install.py --dry-run
```

Then create the links:

```console
./install.py
```

Existing configurations are moved to timestamped `.bak` files before links are
created. Re-running the installer skips links that are already correct.
