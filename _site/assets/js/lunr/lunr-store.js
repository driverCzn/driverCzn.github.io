var store = [{
        "title": "使用CMake为每一个C文件生成可执行对象",
        "excerpt":"由于CLion似乎对CMake的友好度更高，所以将原有的使用Makefile的工作方式改为CMake。 原项目结构如下： how2heap/ Makefile {source_files}.c ... glibc_2.25/ {source_files}.c glibc_2.26/ {source_files}.c 原有的Makefile内容如下，功能就是为每个C源文件单独生成一个可执行文件。 BASE = fastbin_dup malloc_playground first_fit calc_tcache_idx V2.25 = glibc_2.25/fastbin_dup_into_stack glibc_2.25/fastbin_dup_consolidate glibc_2.25/unsafe_unlink glibc_2.25/house_of_spirit glibc_2.25/poison_null_byte glibc_2.25/house_of_lore glibc_2.25/overlapping_chunks glibc_2.25/overlapping_chunks_2 glibc_2.25/house_of_force glibc_2.25/large_bin_attack glibc_2.25/unsorted_bin_attack glibc_2.25/unsorted_bin_into_stack glibc_2.25/house_of_einherjar glibc_2.25/house_of_orange V2.26 = glibc_2.26/unsafe_unlink glibc_2.26/house_of_lore glibc_2.26/overlapping_chunks glibc_2.26/large_bin_attack glibc_2.26/unsorted_bin_attack glibc_2.26/unsorted_bin_into_stack glibc_2.26/house_of_einherjar glibc_2.26/tcache_dup glibc_2.26/tcache_poisoning glibc_2.26/tcache_house_of_spirit PROGRAMS = $(BASE) $(V2.25) $(V2.26)...","categories": ["项目管理"],
        "tags": ["CMake","Makefile","CLion"],
        "url": "/%E9%A1%B9%E7%9B%AE%E7%AE%A1%E7%90%86/2020/02/11/cmake.html",
        "teaser": null
      },{
        "title": "Tcache index计算以及CHUNKSIZE大小",
        "excerpt":"本文为基础内容。 根据how2heap上描述的Tcache index计算规则，即： #define request2size(req) \\ (((req) + SIZE_SZ + MALLOC_ALIGN_MASK &lt; MINSIZE) ? \\ MINSIZE : \\ ((req) + SIZE_SZ + MALLOC_ALIGN_MASK) &amp; ~MALLOC_ALIGN_MASK) /* When \"x\" is from chunksize(). */ # define csize2tidx(x) (((x) - MINSIZE + MALLOC_ALIGNMENT - 1) / MALLOC_ALIGNMENT) /* When \"x\" is a user-provided...","categories": ["二进制安全"],
        "tags": ["how2heap","tcache","chunk"],
        "url": "/%E4%BA%8C%E8%BF%9B%E5%88%B6%E5%AE%89%E5%85%A8/2020/02/21/tcache-idx.html",
        "teaser": null
      },{
        "title": "GDB指定被调试程序环境变量",
        "excerpt":"当碰到一个程序需要指定版本的ld以及libc的情况，在命令行直接运行比较简单： 使用patchelf的--set-interpreter功能就可以对文件进行patch以指定ld。 经过第一步patch文件后，运行程序时配合LD_PRELOAD指定libc即可。 但是想用GDB获得同样的体验就比较麻烦。 set env 无效 简单的(gdb) set env LD_PRELOAD=\"xxx\"没有达到预期，连程序都跑不起来。 pwndbg&gt; set environment LD_PRELOAD ./glibc_versions/libc-2.25.so pwndbg&gt; start Exception occurred: entry: During startup program terminated with signal SIGSEGV, Segmentation fault. (&lt;class 'gdb.error'&gt;) For more info invoke `set exception-verbose on` and rerun the command or debug it by yourself with `set...","categories": ["二进制安全"],
        "tags": ["gdb","环境变量","LD_PRELOAD"],
        "url": "/%E4%BA%8C%E8%BF%9B%E5%88%B6%E5%AE%89%E5%85%A8/2020/02/22/gdb-exec-wrapper.html",
        "teaser": null
      },{
        "title": "Jekyll本地预览看不到刚写的post",
        "excerpt":"今天刚写了一篇post，想本地预览一下效果，结果神奇的事情出现了……   bundle exec jekyll serve一顿操作，然后，么的动静，仿佛这一篇文章从未出现过。   然鹅直接扔给github-pages却是可以正常显示的。   我又创建了几个测试的post，改改文件名，甚至一度以为是因为我文件名里有exec这种玩意儿被过滤掉了，但是当我把文件名写成test都不行的时候，发现事情并不简单。   因为jekyll默认是根据文件名来判断日期的，所以又改了下文件名里的日期，神奇的事情又出现了……   UTC+8现在是2020年2月22日周六，但是经过测试只有文件名是21号及以前的才显示，难道我一不小心贡献出了一些时间？   吓得我赶紧打开了详细信息看一下啥情况，结果出来了，还好，时间没有贡献掉：      由于我虚拟机的时区用了默认的，时间才21号周五，jekyll跳过了未来日期的post，自然就看不到了。   破案了，完结撒花。  ","categories": ["博客"],
        "tags": ["Jekyll","时间"],
        "url": "/%E5%8D%9A%E5%AE%A2/2020/02/22/jekyll-post-disappear.html",
        "teaser": null
      },{
        "title": "从源码调试_int_free看how2heap之unlink",
        "excerpt":"首先说一下个人感受，unlink是个在没有理解的情况下可能完全摸不着头脑的技术点。并且本来就没有搞清楚的东西还没有源码的话，就更头疼了。 本文首发于安全客 unlink是个malloc.c文件里的宏，由于是个宏，所以经过编译以后已经inline了，虽然可以找到原始的宏定义，但是看起来毕竟没有那么直观，所以本文从源码调试入手，一次看清unlink的细节。 几个关键的技术点如下： unlink是在哪个函数里被执行的？ unlink的几个参数分别是什么意思？ unlink的结果是什么？ 为什么进行unlink攻击要伪造一个chunk？用原始的chunk只改变fd和bk就不可以吗？ 如何进行源码调试 首先使用how2heap提供的脚本build出实验需要的2.25版本的ld和libc，如下： $ ./glibc_build.sh -h Usage: ./glibc_build.sh version #make-threads $ ./glibc_build.sh 2.25 8 这里编译使用8线程，可以根据CPU情况调高线程数加快编译，整个过程花费时间可能较长。 如果卡在git clone那一步，建议指定http_proxy并将glibc_build.sh中git clone后的协议改为http。 编译出的ld和libc会放在glibc_versions目录下，clone下来的源码在glibc_src目录。 由于这里要进行的是2.25版本的调试，所以如果你依次build了2.25和2.26版本的，请到glibc_src目录下进行git checkout release/2.25/master将源文件恢复到2.25版本的状态以便后续调试。 接下来修改待调试文件的ld,有两种方法，可以自由选择： # 首先要sudo apt install patchelf，以下两种方法实际上都是用了这个工具。 # 1. 使用现成的glibc_run.sh，脚本中含有patch待调试程序的功能。 $ ./glibc_run.sh 2.25 [exe] # 2. 直接使用patchelf $ patchelf --set-interpreter [path_to_ld] [exe]...","categories": ["二进制安全"],
        "tags": ["how2heap","unlink","chunk","源码"],
        "url": "/%E4%BA%8C%E8%BF%9B%E5%88%B6%E5%AE%89%E5%85%A8/2020/02/24/how2heap-unlink.html",
        "teaser": null
      },{
        "title": "Jekyll and Org together",
        "excerpt":"dsa  asd  abc  test  123  test2  321  test3  1  123  asda     link test 2   file link test     link test3      link test4      org mode      lk123  return 123  agenda  lists  123 [25%]     [ ] asd   [ ] dsa   [X] lkj   [ ] jkl   ","categories": [],
        "tags": ["test2"],
        "url": "/2021/03/20/test.html",
        "teaser": null
      },{
        "title": "Abc",
        "excerpt":"Document Title   ","categories": [],
        "tags": [],
        "url": "/2021/04/06/abc.html",
        "teaser": null
      },{
        "title": "Liquid",
        "excerpt":"              Home           hello world! 222 3        ","categories": [],
        "tags": [],
        "url": "/2021/04/07/liquid.html",
        "teaser": null
      }]
