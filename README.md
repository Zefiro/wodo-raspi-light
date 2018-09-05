wodo-raspi-light
================

Raspi-based control for a TM1829 based LED strip in JavaScript

 Modules
---------
Effects are little JS objects which are loaded using addEffect(<name>). They are searched in the /fx subdirectory as /fx/<name>.js and loaded with require()

Each module can contribute to the global variables dictionary, by having a dictionary called 'variables'.
This will be placed in the global 'variables' dictionary with <name> used as a key.
Other modules can then refer to those (but need to ensure they exist)

Each module can be loaded multiple times and placed in the global fx[] array at some unused index. However, the variables currently are global.


 TODO
======
  * change config updates to adaptive latency, i.e. only send out a new update if the client is ready (perhaps implement a window, like TCP?). Postpone an update if client is not ready until it is, replace and drop this update if a new one comes in inbetween
  * enable "binding" of values to variables, by string-expression parsing (perhaps start simpler with a dropdown of available variables and no modifications)
  * enable update of config (incl. push-out) from other sources (i.e. the automatic frame update)
  * split variable calculation and color processing
  * improve documentation, especially about the "fx module interface"
  
 INFO
======
Apparently the on-board sound also uses DMA and cannot be used in parallel. I didn't have any issues with just not using sound, but possibly the sound driver needs to be deactivated.
See https://pypi.org/project/rpi_ws281x/ and http://jheyman.github.io/blog/pages/RaspberryPiTipsAndTricks/
