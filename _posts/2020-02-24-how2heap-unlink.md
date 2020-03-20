---
title: 从源码调试_int_free看how2heap之unlink
categories:
  - 二进制安全
tags:
  - how2heap
  - unlink
  - chunk
  - 源码
typora-root-url: ..
---

首先说一下个人感受，unlink是个在没有理解的情况下可能完全摸不着头脑的技术点。并且本来就没有搞清楚的东西还没有源码的话，就更头疼了。

> 本文首发于[安全客](https://www.anquanke.com/post/id/199552)

unlink是个malloc.c文件里的宏，由于是个宏，所以经过编译以后已经inline了，虽然可以找到原始的宏定义，但是看起来毕竟没有那么直观，所以本文从源码调试入手，一次看清unlink的细节。

几个关键的技术点如下：

1. unlink是在哪个函数里被执行的？
2. unlink的几个参数分别是什么意思？
3. unlink的结果是什么？
4. 为什么进行unlink攻击要伪造一个chunk？用原始的chunk只改变fd和bk就不可以吗？

## 如何进行源码调试

### 首先使用how2heap提供的脚本build出实验需要的2.25版本的ld和libc，如下：

```sh
$ ./glibc_build.sh -h
Usage: ./glibc_build.sh version #make-threads
$ ./glibc_build.sh 2.25 8
```

这里编译使用8线程，可以根据CPU情况调高线程数加快编译，整个过程花费时间可能较长。

如果卡在git clone那一步，建议指定http_proxy并将glibc_build.sh中git clone后的协议改为http。

编译出的ld和libc会放在glibc_versions目录下，clone下来的源码在glibc_src目录。

由于这里要进行的是2.25版本的调试，所以如果你依次build了2.25和2.26版本的，请到glibc_src目录下进行`git checkout release/2.25/master`将源文件恢复到2.25版本的状态以便后续调试。

### 接下来修改待调试文件的ld,有两种方法，可以自由选择：

```sh
# 首先要sudo apt install patchelf，以下两种方法实际上都是用了这个工具。
# 1. 使用现成的glibc_run.sh，脚本中含有patch待调试程序的功能。
$ ./glibc_run.sh 2.25 [exe]
# 2. 直接使用patchelf
$ patchelf --set-interpreter [path_to_ld] [exe]
```

文件patch好以后，只要在执行或者调试时设置LD_PRELOAD指向相应的libc就可以了。

如何在GDB中设置LD_PRELOAD可以看我前几天写的[GDB指定被调试程序环境变量](http://www.j10.monster/二进制安全/2020/02/22/gdb-exec-wrapper.html)。

简单提一句就是在GDB中`set exec-wrapper env 'LD_PRELOAD=./glibc_versions/libc-2.25.so'`

接下来就可以愉快的进行调试了。调试使用了[pwndbg](https://github.com/pwndbg/pwndbg)。

## unlink是在哪个函数里被执行的？

源代码想必点开这篇文章的小伙伴们手里都有，为了突出重点，这里就不贴了。（如果没有快去[这里](https://github.com/shellphish/how2heap/blob/master/glibc_2.25/unsafe_unlink.c)看一下

单步跟踪可以发现chunk0_ptr的值第一次被改变是在第46行的`free(chunk1_ptr)`执行完之后。那么我们先`b unsafe_unlink.c:46`在执行这一行之前停下，然后`si`步进。

在main函数中`call free@plt`之前应该看起来是这个样子:

![](/assets/images/Snipaste_2020-02-24_11-01-40.png)

进入free函数时看起来应该是这个样子：

![](/assets/images/Snipaste_2020-02-24_11-06-35.png)

如果你看到和我一样的界面的话，说明上面的配置没有问题；如果看不到malloc.c的源码的话，建议检查上面哪一步出了问题。（当RIP在free@plt的时候不会看到malloc.c源码，详细信息请搜索“延时绑定、plt”相关内容）

`ni`了几步之后进入了_int_free函数，这也就是我们分析的重点。

打开malloc.c源文件（在glibc_src/malloc/malloc.c），可以看到_int_free函数中有2处调用了unlink，分别用于后向合并以及前向合并。

![](/assets/images/Snipaste_2020-02-24_11-47-43.png)

这里要解释一下unlink的各个参数，顺便讲清楚这两个合并分别是什么效果。

## unlink的几个参数分别是什么意思？

```c
#define unlink(AV, P, BK, FD) {                                            \
    FD = P->fd;                                                               \
    BK = P->bk;                                                               \
    if (__builtin_expect (FD->bk != P || BK->fd != P, 0))                     \
      malloc_printerr (check_action, "corrupted double-linked list", P, AV);  \
    else {                                                                    \
        FD->bk = BK;                                                          \
        BK->fd = FD;                                                          \
        if (!in_smallbin_range (P->size)                                      \
            && __builtin_expect (P->fd_nextsize != NULL, 0)) {                \
            // 与本次实验无关                                                    \
            ......                                                            \
          }                                                                   \
      }                                                                       \
}
```

这里截取了相关代码，可以看到FD和BK都比较好理解，P指向将要从双向链表中取下的chunk的头部。

那么这个AV是什么？可以看到malloc.c中第4019行的unlink的av是由_int_free的参数传入的，

```c
static void
_int_free (mstate av, mchunkptr p, int have_lock)
{
    ......
```

看到av的类型是mstate。

```c
static struct malloc_state main_arena =
{
  .mutex = _LIBC_LOCK_INITIALIZER,
  .next = &main_arena,
  .attached_threads = 1
};
......
mstate ar_ptr = &main_arena;
```

从mstate的类型可以看出av是一个指向分配区（arena）的指针，那么av可能是arena vector的意思。

所以这里不需要关心AV这个参数有什么用。

那再来看看后向合并和前向合并是什么意思？

* 后向合并只要free函数指向的chunk的前一个chunk是未使用状态就会触发，用于将物理相邻的前一个chunk与后一个chunk合并，合并的结果是chunk开始于前chunk，大小为两个chunk之和，并且后chunk被unlink宏从双向链表中取下。
* 前向合并只有检测到下一个chunk不是当前分配区的topchunk并且是未使用状态才会触发，合并结果是将后chunk合并入前chunk，新的chunk开始于前chunk，大小为两个chunk之和。若下一个chunk就是topchunk，则直接将当前chunk变为topchunk。

经过前面对于chunk1_ptr指向的chunk1的metadata的修改，_int_free会认为我们在chunk0_ptr指向的chunk0中伪造的chunk是未使用状态，因此会将这个fake chunk的开始地址也就是chunk1_hdr-0x80作为unlink宏的P的值，以此触发unlink。

## unlink的结果是什么？

我们从malloc.c第4015行的后向合并开始：

![](/assets/images/Snipaste_2020-02-24_15-00-32.png)

```asm
0x7ffff7ab4710 <_int_free+416>    test   byte ptr [rbx + 8], 1
=> rbx= p =0x555555758090

0x7ffff7ab4716 <_int_free+422>    mov    rax, qword ptr [rbx]
=> rax=0x80

0x7ffff7ab4719 <_int_free+425>    sub    rbx, rax
=> rbx -= 0x80
=> rbx= p =0x555555758010  <-------------- fake mchunkptr

0x7ffff7ab471c <_int_free+428>    add    r12, rax
=> r12= size =size+prevsize=r12+rax=0x90+0x80=0x110
```

以上几行设置好了P为fake chunk的开始地址以及chunk大小，接下来第4019行开始unlink：

![](/assets/images/Snipaste_2020-02-24_14-49-19.png)

```assembly
-------------------unlink-------------------
0x7ffff7ab471f <_int_free+431>    mov    rax, qword ptr [rbx + 0x10]
=> rax= FD =p->fd=0x555555756018

0x7ffff7ab4723 <_int_free+435>    mov    rdx, qword ptr [rbx + 0x18]
=> rdx= BK =p->bk=0x555555756020

0x7ffff7ab4727 <_int_free+439>    cmp    qword ptr [rax + 0x18], rbx
=> test FD->bk==p

0x7ffff7ab4731 <_int_free+449>    cmp    qword ptr [rdx + 0x10], rbx
=> test BK->fd==p

0x7ffff7ab473b <_int_free+459>    cmp    qword ptr [rbx + 8], 0x3ff
=> test p->size>small_bin_range

0x7ffff7ab4743 <_int_free+467>    mov    qword ptr [rax + 0x18], rdx
=> FD->bk = BK
=> qword ptr [0x555555756030] = 0x555555756020

0x7ffff7ab4747 <_int_free+471>    mov    qword ptr [rdx + 0x10], rax
=> BK->fd = FD
=> qword ptr [0x555555756030] = 0x555555756018
=> qword ptr [&chunk0_ptr] = ((char *)&chunk0_ptr)-0x18

p->size in small_bin_range, so unlink finish.
-----------------------------------------------
```

这里unlink设置好FD以及BK，并且测试完`FD->bk==p`和`BK->fd==p`之后，就开始了原本应该将该chunk从双向链表取下的操作，而攻击正是发生在这里。

由于FD->bk与BK->fd指向的都是变量chunk0_ptr所在的内存地址，因此对这两个指针的赋值其实都是直接改变了chunk0_ptr的值，由于是往同一个地方写入，第二次赋值为FD会覆盖第一次赋值为BK的效果，最终结果就是`chunk0_ptr=(&chunk0_ptr)-3`。

此时再使用`chunk0_ptr[3]=0xdeadbeef`这种写法就可以将chunk0_ptr的值覆写为任意想要的地址。

实验最后是将chunk0_ptr覆写为了一个字符串的地址并且更改了字符串的内容，攻击完成。

## 为什么进行unlink攻击要伪造一个chunk？

有小伙伴可能要问：“我看实验步骤里有一个伪造chunk的过程，改变了前一个chunk的大小，那我不改这个大小，直接把fd和bk的值填进chunk0_ptr[0]、[1]行不行？”

结果是不行的。由于有`FD->bk==p`和`BK->fd==p`这两个检测的设定，并且`FD->bk`和`BK->fd`指向的都是chunk0_ptr所在地址，相当于p必须等于chunk0_ptr的值，即实验中伪造的chunk的开始地址，差一个字节都不行。

## 结语

好了，分析到这里就结束了，这个攻击方法虽然对>2.25版本的glibc都无效，但是其中的很多细节都是值得学习的，希望各位看得开心，有什么问题可以一起讨论鸭。
