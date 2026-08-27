# my dotfiles :3

my desktop rice, heavily based on the post-punk / Joy Division style

thx a lot to [diinki](https://github.com/diinki) - stole some configs from him
and they taught me how to do this stuff :3

it's made for my dual monitor setup btw

the configs live here and just get linked into `~/.config`, so git no longer
has to look at my whole home folder

## installing

you can first check what it wants to do:

```console
./install.py --dry-run
```

then create the links:

```console
./install.py
```

if there is already a config there, it gets moved to a timestamped `.bak` file
before making the link. running it again just skips everything that's already
linked correctly
