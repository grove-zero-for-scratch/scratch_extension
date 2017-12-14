// picoExtension.js
// Shane M. Clements, February 2014
// PicoBoard Scratch Extension
//
// This is an extension for development and testing of the Scratch Javascript Extension API.

(function(ext) {
    var device = null;
    var rawData = null;

    // Buttn states:
    var channels = {
        'Button A': 0,
        'Button B': 1
    };
    
    var inputs = {
        'Button A': 0,
        'Button B': 0
    };

    ext.resetAll = function(){};

    // Hats / triggers
    ext.whenButtonPressed = function(which) {
        return getButtonPressed(which);
    };

    // Private logic
    function getButtonPressed(which) {
        if (device == null) return false;
        if (which == 'A' && getButton('Button A')) return true;
        if (which == 'B' && getButton('Button B')) return true;
        return false;
    }

    function getButton(which) {
        return inputs[which];
    }

    var inputArray = [];
    function processData() {
        var bytes = new Uint8Array(rawData);
        
        inputArray[3] = 0;

        if (watchdog && (inputArray[3] == 0x54)) {
            // Seems to be a valid board.
            clearTimeout(watchdog);
            watchdog = null;
        }

        console.log(bytes);
        rawData = null;
    }

    function appendBuffer(buffer1, buffer2) {
        var tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
        tmp.set(new Uint8Array(buffer1), 0);
        tmp.set(new Uint8Array(buffer2), buffer1.byteLength);
        return tmp.buffer;
    }

    // Extension API interactions
    var potentialDevices = [];
    ext._deviceConnected = function(dev) {
        potentialDevices.push(dev);

        if (!device) {
            tryNextDevice();
        }
    }

    var poller = null;
    var watchdog = null;
    function tryNextDevice() {
        // If potentialDevices is empty, device will be undefined.
        // That will get us back here next time a device is connected.
        device = potentialDevices.shift();
        if (!device) return;

        device.open({ stopBits: 0, bitRate: 38400, ctsFlowControl: 0 });
        console.log('Attempting connection with ' + device.id);
        device.set_receive_handler(function(data) {
            console.log('Received: ' + data.byteLength);
            if(!rawData || rawData.byteLength == 4) rawData = new Uint8Array(data);
            else rawData = appendBuffer(rawData, data);

            if(rawData.byteLength >= 4) {
                console.log(rawData);
                processData();
            }
        });

        // Tell the PicoBoard to send a input data every 50ms
        var pingCmd = new Uint8Array(1);
        pingCmd[0] = 0x01;
        poller = setInterval(function() {
            device.send(pingCmd.buffer);
        }, 1000);
        watchdog = setTimeout(function() {
            // This device didn't get good data in time, so give up on it. Clean up and then move on.
            // If we get good data then we'll terminate this watchdog.
            clearInterval(poller);
            poller = null;
            device.set_receive_handler(null);
            device.close();
            device = null;
            tryNextDevice();
        }, 250);
    };

    ext._deviceRemoved = function(dev) {
        if(device != dev) return;
        if(poller) poller = clearInterval(poller);
        device = null;
    };

    ext._shutdown = function() {
        if(device) device.close();
        if(poller) poller = clearInterval(poller);
        device = null;
    };

    ext._getStatus = function() {
        if(!device) return {status: 1, msg: 'Disconnected'};
        if(watchdog) return {status: 1, msg: 'Probing'};
        return {status: 2, msg: 'Connected'};
    }

    var descriptor = {
        blocks: [
            ['h', 'when %m.btns button pressed', 'whenButtonPressed', 'A']
        ],
        menus: {
            btns: ['A', 'B']
        },
        url: 'www.seeedstudio.com'
    };
    ScratchExtensions.register('Grove Zero', descriptor, ext, {type: 'serial'});
})({});