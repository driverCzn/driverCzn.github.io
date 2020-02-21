---
title: Tcache index计算以及CHUNKSIZE大小
categories:
  - 二进制安全
tags:
  - how2heap
  - tcache
  - chunk
---

本文为基础内容。

根据[how2heap](https://github.com/shellphish/how2heap/blob/master/calc_tcache_idx.c)上描述的Tcache index计算规则，即：

```c
#define request2size(req)                                         \
  (((req) + SIZE_SZ + MALLOC_ALIGN_MASK < MINSIZE)  ?             \
   MINSIZE :                                                      \
   ((req) + SIZE_SZ + MALLOC_ALIGN_MASK) & ~MALLOC_ALIGN_MASK)

/* When "x" is from chunksize().  */
# define csize2tidx(x) (((x) - MINSIZE + MALLOC_ALIGNMENT - 1) / MALLOC_ALIGNMENT)

/* When "x" is a user-provided size.  */
# define usize2tidx(x) csize2tidx (request2size (x))

```

宏`usize2tidx`用于计算IDX的值，可以看到分两步：

1. 用request2size将用户输入的数值转换为CHUNKSIZE
2. 用csize2tidx将CHUNKSIZE转换为IDX

#### request2size：

在64位机器上，SIZE_SZ=0x8，MALLOC_ALIGN_MASK=0xf，MINSIZE=0x20

`((req) + SIZE_SZ + MALLOC_ALIGN_MASK) & ~MALLOC_ALIGN_MASK)`在这里用于将用户请求的值x加上8之后进行16字节向上取整。

可以根据规则计算得出，x<=0x18时，CHUNKSIZE均为0x20；0x19~0x28为0x30，以此类推。

#### csize2tidx：

在得到CHUNKSIZE后，计算IDX十分简单，只要将CHUNKSIZE减去0x11然后使用MALLOC_ALIGNMENT整除即可。

