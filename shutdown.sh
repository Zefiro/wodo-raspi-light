#/bin/sh

# Calls poweroff, which is a bit nicer than just switching off the RasPi power
#
# this file needs to be setuid root to work:
# sudo chown root:root shutdown.sh && sudo chmod 4744 shutdown.sh

/sbin/poweroff
