---
title: GDB指定被调试程序环境变量
categories:
  - 二进制安全
tags:
  - gdb
  - 环境变量
  - LD_PRELOAD
---

当碰到一个程序需要指定版本的ld以及libc的情况，在命令行直接运行比较简单：

1. 使用`patchelf`的`--set-interpreter`功能就可以对文件进行patch以指定ld。
2. 经过第一步patch文件后，运行程序时配合LD_PRELOAD指定libc即可。

但是想用GDB获得同样的体验就比较麻烦。

#### set env 无效

简单的`(gdb) set env LD_PRELOAD="xxx"`没有达到预期，连程序都跑不起来。

```sh
pwndbg> set environment LD_PRELOAD ./glibc_versions/libc-2.25.so
pwndbg> start
Exception occurred: entry: During startup program terminated with signal SIGSEGV, Segmentation fault. (<class 'gdb.error'>)
For more info invoke `set exception-verbose on` and rerun the command
or debug it by yourself with `set exception-debugger on`
^CQuit
pwndbg> set exception-verbose on
Set whether to print a full stacktracefor exceptions raised in Pwndbg commands to True
pwndbg> start
Traceback (most recent call last):
  File "/home/fp/pwndbg/pwndbg/commands/__init__.py", line 136, in __call__
    return self.function(*args, **kwargs)
  File "/home/fp/pwndbg/pwndbg/commands/__init__.py", line 216, in _OnlyWithFile
    return function(*a, **kw)
  File "/home/fp/pwndbg/pwndbg/commands/start.py", line 95, in entry
    gdb.execute(run, from_tty=False)
gdb.error: During startup program terminated with signal SIGSEGV, Segmentation fault.

If that is an issue, you can report it on https://github.com/pwndbg/pwndbg/issues
(Please don't forget to search if it hasn't been reported before)
To generate the report and open a browser, you may run `bugreport --run-browser`
PS: Pull requests are welcome
^CQuit
```

#### 解决方案

解决方案来自[stackoverflow](https://stackoverflow.com/a/41822591)。

`(gdb) set exec-wrapper env 'LD_PRELOAD=./glibc_versions/libc-2.25.so'`即可指定libc文件。

实际效果如下：

<script id="asciicast-z5RvTWuimlGborC5fBqeayRQM" src="https://asciinema.org/a/z5RvTWuimlGborC5fBqeayRQM.js" async></script>

