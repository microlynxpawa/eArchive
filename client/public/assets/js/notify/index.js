'use strict';
if (typeof window !== 'undefined' && window.$ && typeof window.$.notify === 'function') {
    var notify = $.notify('<i class="fa fa-bell-o"></i><strong>Loading</strong> page Do not close this page...', {
        type: 'theme',
        allow_dismiss: true,
        delay: 2000,
        showProgressbar: true,
        timer: 300,
        animate:{
            enter:'animated fadeInDown',
            exit:'animated fadeOutUp'
        }
    });

    setTimeout(function() {
        notify.update('message', '<i class="fa fa-bell-o"></i><strong>Loading</strong> Inner Data.');
    }, 1000);
} else {
    // notify plugin not available yet - skip silently
}
