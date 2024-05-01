/* FileSaver.js
 * A saveAs() FileSaver implementation.
 * 1.3.2
 * 2016-06-16 18:25:19
 *
 * By Eli Grey, http://eligrey.com
 * License: MIT
 *   See https://github.com/eligrey/FileSaver.js/blob/master/LICENSE.md
 */

/*global self */
/*jslint bitwise: true, indent: 4, laxbreak: true, laxcomma: true, smarttabs: true, plusplus: true */

/*! @source http://purl.eligrey.com/github/FileSaver.js/blob/master/FileSaver.js */

var saveAs = saveAs || (function(view) {
	"use strict";
	// IE <10 is explicitly unsupported
	if (typeof view === "undefined" || typeof navigator !== "undefined" && /MSIE [1-9]\./.test(navigator.userAgent)) {
		return;
	}
	var
		  doc = view.document
		  // only get URL when necessary in case Blob.js hasn't overridden it yet
		, get_URL = function() {
			return view.URL || view.webkitURL || view;
		}
		, save_link = doc.createElementNS("http://www.w3.org/1999/xhtml", "a")
		, can_use_save_link = "download" in save_link
		, click = function(node) {
			var event = new MouseEvent("click");
			node.dispatchEvent(event);
		}
		, is_safari = /constructor/i.test(view.HTMLElement)
		, is_chrome_ios =/CriOS\/[\d]+/.test(navigator.userAgent)
		, throw_outside = function(ex) {
			(view.setImmediate || view.setTimeout)(function() {
				throw ex;
			}, 0);
		}
		, force_saveable_type = "application/octet-stream"
		// the Blob API is fundamentally broken as there is no "downloadfinished" event to subscribe to
		, arbitrary_revoke_timeout = 1000 * 40 // in ms
		, revoke = function(file) {
			var revoker = function() {
				if (typeof file === "string") { // file is an object URL
					get_URL().revokeObjectURL(file);
				} else { // file is a File
					file.remove();
				}
			};
			setTimeout(revoker, arbitrary_revoke_timeout);
		}
		, dispatch = function(filesaver, event_types, event) {
			event_types = [].concat(event_types);
			var i = event_types.length;
			while (i--) {
				var listener = filesaver["on" + event_types[i]];
				if (typeof listener === "function") {
					try {
						listener.call(filesaver, event || filesaver);
					} catch (ex) {
						throw_outside(ex);
					}
				}
			}
		}
		, auto_bom = function(blob) {
			// prepend BOM for UTF-8 XML and text/* types (including HTML)
			// note: your browser will automatically convert UTF-16 U+FEFF to EF BB BF
			if (/^\s*(?:text\/\S*|application\/xml|\S*\/\S*\+xml)\s*;.*charset\s*=\s*utf-8/i.test(blob.type)) {
				return new Blob([String.fromCharCode(0xFEFF), blob], {type: blob.type});
			}
			return blob;
		}
		, FileSaver = function(blob, name, no_auto_bom) {
			if (!no_auto_bom) {
				blob = auto_bom(blob);
			}
			// First try a.download, then web filesystem, then object URLs
			var
				  filesaver = this
				, type = blob.type
				, force = type === force_saveable_type
				, object_url
				, dispatch_all = function() {
					dispatch(filesaver, "writestart progress write writeend".split(" "));
				}
				// on any filesys errors revert to saving with object URLs
				, fs_error = function() {
					if ((is_chrome_ios || (force && is_safari)) && view.FileReader) {
						// Safari doesn't allow downloading of blob urls
						var reader = new FileReader();
						reader.onloadend = function() {
							var url = is_chrome_ios ? reader.result : reader.result.replace(/^data:[^;]*;/, 'data:attachment/file;');
							var popup = view.open(url, '_blank');
							if(!popup) view.location.href = url;
							url=undefined; // release reference before dispatching
							filesaver.readyState = filesaver.DONE;
							dispatch_all();
						};
						reader.readAsDataURL(blob);
						filesaver.readyState = filesaver.INIT;
						return;
					}
					// don't create more object URLs than needed
					if (!object_url) {
						object_url = get_URL().createObjectURL(blob);
					}
					if (force) {
						view.location.href = object_url;
					} else {
						var opened = view.open(object_url, "_blank");
						if (!opened) {
							// Apple does not allow window.open, see https://developer.apple.com/library/safari/documentation/Tools/Conceptual/SafariExtensionGuide/WorkingwithWindowsandTabs/WorkingwithWindowsandTabs.html
							view.location.href = object_url;
						}
					}
					filesaver.readyState = filesaver.DONE;
					dispatch_all();
					revoke(object_url);
				}
			;
			filesaver.readyState = filesaver.INIT;

			if (can_use_save_link) {
				object_url = get_URL().createObjectURL(blob);
				setTimeout(function() {
					save_link.href = object_url;
					save_link.download = name;
					click(save_link);
					dispatch_all();
					revoke(object_url);
					filesaver.readyState = filesaver.DONE;
				});
				return;
			}

			fs_error();
		}
		, FS_proto = FileSaver.prototype
		, saveAs = function(blob, name, no_auto_bom) {
			return new FileSaver(blob, name || blob.name || "download", no_auto_bom);
		}
	;
	// IE 10+ (native saveAs)
	if (typeof navigator !== "undefined" && navigator.msSaveOrOpenBlob) {
		return function(blob, name, no_auto_bom) {
			name = name || blob.name || "download";

			if (!no_auto_bom) {
				blob = auto_bom(blob);
			}
			return navigator.msSaveOrOpenBlob(blob, name);
		};
	}

	FS_proto.abort = function(){};
	FS_proto.readyState = FS_proto.INIT = 0;
	FS_proto.WRITING = 1;
	FS_proto.DONE = 2;

	FS_proto.error =
	FS_proto.onwritestart =
	FS_proto.onprogress =
	FS_proto.onwrite =
	FS_proto.onabort =
	FS_proto.onerror =
	FS_proto.onwriteend =
		null;

	return saveAs;
}(
	   typeof self !== "undefined" && self
	|| typeof window !== "undefined" && window
	|| this.content
));
// `self` is undefined in Firefox for Android content script context
// while `this` is nsIContentFrameMessageManager
// with an attribute `content` that corresponds to the window

if (typeof module !== "undefined" && module.exports) {
  module.exports.saveAs = saveAs;
} else if ((typeof define !== "undefined" && define !== null) && (define.amd !== null)) {
  define([], function() {
    return saveAs;
  });
}



var device = null;
let firmwareFile2;

(function ()
{
  'use strict';

  function hex4(n)
  {
    let s = n.toString(16)
    while (s.length < 4)
    {
      s = '0' + s;
    }
    return s;
  }

  function hexAddr8(n)
  {
    let s = n.toString(16)
    while (s.length < 8)
    {
      s = '0' + s;
    }
    return "0x" + s;
  }

  function niceSize(n)
  {
    const gigabyte = 1024 * 1024 * 1024;
    const megabyte = 1024 * 1024;
    const kilobyte = 1024;
    if (n >= gigabyte)
    {
      return n / gigabyte + "GiB";
    }
    else if (n >= megabyte)
    {
      return n / megabyte + "MiB";
    }
    else if (n >= kilobyte)
    {
      return n / kilobyte + "KiB";
    }
    else
    {
      return n + "B";
    }
  }

  function formatDFUSummary(device)
  {
    const vid = hex4(device.device_.vendorId);
    const pid = hex4(device.device_.productId);
    const name = device.device_.productName;

    let mode = "Unknown"
    if (device.settings.alternate.interfaceProtocol == 0x01)
    {
      mode = "Runtime";
    }
    else if (device.settings.alternate.interfaceProtocol == 0x02)
    {
      mode = "DFU";
    }

    const cfg = device.settings.configuration.configurationValue;
    const intf = device.settings["interface"].interfaceNumber;
    const alt = device.settings.alternate.alternateSetting;
    const serial = device.device_.serialNumber;
    let info = `${mode}: [${vid}:${pid}] cfg=${cfg}, intf=${intf}, alt=${alt}, name="${name}" serial="${serial}"`;
    return info;
  }

  function formatDFUInterfaceAlternate(settings)
  {
    let mode = "Unknown"
    if (settings.alternate.interfaceProtocol == 0x01)
    {
      mode = "Runtime";
    }
    else if (settings.alternate.interfaceProtocol == 0x02)
    {
      mode = "DFU";
    }

    const cfg = settings.configuration.configurationValue;
    const intf = settings["interface"].interfaceNumber;
    const alt = settings.alternate.alternateSetting;
    const name = (settings.name) ? settings.name : "UNKNOWN";

    return `${mode}: cfg=${cfg}, intf=${intf}, alt=${alt}, name="${name}"`;
  }

  async function fixInterfaceNames(device_, interfaces)
  {
    // Check if any interface names were not read correctly
    if (interfaces.some(intf => (intf.name == null)))
    {
      // Manually retrieve the interface name string descriptors
      let tempDevice = new dfu.Device(device_, interfaces[0]);
      await tempDevice.device_.open();
      await tempDevice.device_.selectConfiguration(1);
      let mapping = await tempDevice.readInterfaceNames();
      await tempDevice.close();

      for (let intf of interfaces)
      {
        if (intf.name === null)
        {
          let configIndex = intf.configuration.configurationValue;
          let intfNumber = intf["interface"].interfaceNumber;
          let alt = intf.alternate.alternateSetting;
          intf.name = mapping[configIndex][intfNumber][alt];
        }
      }
    }
  }

  function populateInterfaceList(form, device_, interfaces)
  {
    let old_choices = Array.from(form.getElementsByTagName("div"));
    for (let radio_div of old_choices)
    {
      form.removeChild(radio_div);
    }

    let button = form.getElementsByTagName("button")[0];

    for (let i = 0; i < interfaces.length; i++)
    {
      let radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "interfaceIndex";
      radio.value = i;
      radio.id = "interface" + i;
      radio.required = true;

      let label = document.createElement("label");
      label.textContent = formatDFUInterfaceAlternate(interfaces[i]);
      label.className = "radio"
      label.setAttribute("for", "interface" + i);

      let div = document.createElement("div");
      div.appendChild(radio);
      div.appendChild(label);
      form.insertBefore(div, button);
    }
  }

  function getDFUDescriptorProperties(device)
  {
    // Attempt to read the DFU functional descriptor
    // TODO: read the selected configuration's descriptor
    return device.readConfigurationDescriptor(0).then(
      data =>
      {
        let configDesc = dfu.parseConfigurationDescriptor(data);
        let funcDesc = null;
        let configValue = device.settings.configuration.configurationValue;
        if (configDesc.bConfigurationValue == configValue)
        {
          for (let desc of configDesc.descriptors)
          {
            if (desc.bDescriptorType == 0x21 && desc.hasOwnProperty("bcdDFUVersion"))
            {
              funcDesc = desc;
              break;
            }
          }
        }

        if (funcDesc)
        {
          return {
            WillDetach: ((funcDesc.bmAttributes & 0x08) != 0),
            ManifestationTolerant: ((funcDesc.bmAttributes & 0x04) != 0),
            CanUpload: ((funcDesc.bmAttributes & 0x02) != 0),
            CanDnload: ((funcDesc.bmAttributes & 0x01) != 0),
            TransferSize: funcDesc.wTransferSize,
            DetachTimeOut: funcDesc.wDetachTimeOut,
            DFUVersion: funcDesc.bcdDFUVersion
          };
        }
        else
        {
          return {};
        }
      },
      error =>
      {}
    );
  }

  // Current log div element to append to
  let logContext = null;

  function setLogContext(div)
  {
    logContext = div;
  };

  function clearLog(context)
  {
    if (typeof context === 'undefined')
    {
      context = logContext;
    }
    if (context)
    {
      context.innerHTML = "";
    }
  }

  function logDebug(msg)
  {
    console.log(msg);
  }

  function logInfo(msg)
  {
    if (logContext)
    {
      let info = document.createElement("p");
      info.className = "info";
      info.textContent = msg;
      logContext.appendChild(info);
    }
  }

  function logWarning(msg)
  {
    if (logContext)
    {
      let warning = document.createElement("p");
      warning.className = "warning";
      warning.textContent = msg;
      logContext.appendChild(warning);
    }
  }

  function logError(msg)
  {
    if (logContext)
    {
      let error = document.createElement("p");
      error.className = "error";
      error.textContent = msg;
      logContext.appendChild(error);
    }
  }


  function logProgress(done, total)
  {
    if (logContext)
    {
      let progressBar;
      if (logContext.lastChild.tagName.toLowerCase() == "progress")
      {
        progressBar = logContext.lastChild;
      }
      if (!progressBar)
      {
        progressBar = document.createElement("progress");
        logContext.appendChild(progressBar);
      }
      progressBar.value = done;
      if (typeof total !== 'undefined')
      {
        progressBar.max = total;
      }
    }
  }

  document.addEventListener('DOMContentLoaded', event =>
    {
      let connectButton = document.querySelector("#connect");
      let detachButton = document.querySelector("#detach");
      let downloadButton = document.querySelector("#download");
	  let downloadButton2 = document.querySelector("#downloadB");
      let uploadButton = document.querySelector("#upload");
      let statusDisplay = document.querySelector("#status");
      let infoDisplay = document.querySelector("#usbInfo");
      let dfuDisplay = document.querySelector("#dfuInfo");
      let vidField = document.querySelector("#vid");
      let interfaceDialog = document.querySelector("#interfaceDialog");
      let interfaceForm = document.querySelector("#interfaceForm");
      let interfaceSelectButton = document.querySelector("#selectInterface");

      let searchParams = new URLSearchParams(window.location.search);
      let fromLandingPage = false;
      let vid = 0;
      // Set the vendor ID from the landing page URL
      if (searchParams.has("vid"))
      {
        const vidString = searchParams.get("vid");
        try
        {
          if (vidString.toLowerCase().startsWith("0x"))
          {
            vid = parseInt(vidString, 16);
          }
          else
          {
            vid = parseInt(vidString, 10);
          }
          vidField.value = "0x" + hex4(vid).toUpperCase();
          fromLandingPage = true;
        }
        catch (error)
        {
          console.log("Bad VID " + vidString + ":" + error);
        }
      }

      // Grab the serial number from the landing page
      let serial = "";
      if (searchParams.has("serial"))
      {
        serial = searchParams.get("serial");
        // Workaround for Chromium issue 339054
        if (window.location.search.endsWith("/") && serial.endsWith("/"))
        {
          serial = serial.substring(0, serial.length - 1);
        }
        fromLandingPage = true;
      }

      let configForm = document.querySelector("#configForm");

      let transferSizeField = document.querySelector("#transferSize");
      let transferSize = parseInt(transferSizeField.value);

      let dfuseStartAddressField = document.querySelector("#dfuseStartAddress");
      let dfuseUploadSizeField = document.querySelector("#dfuseUploadSize");

      let firmwareFileField = document.querySelector("#firmwareFile");
      let firmwareFile = null;

      let downloadLog = document.querySelector("#downloadLog");
      let uploadLog = document.querySelector("#uploadLog");

      let manifestationTolerant = true;

      //let device;

      function onDisconnect(reason)
      {
        if (reason)
        {
          statusDisplay.textContent = reason;
        }

        connectButton.textContent = "Connect";
        infoDisplay.textContent = "";
        dfuDisplay.textContent = "";
        detachButton.disabled = true;
        uploadButton.disabled = true;
        downloadButton.disabled = true;
		downloadButton2.disabled = true;
        firmwareFileField.disabled = true;
      }

      function onUnexpectedDisconnect(event)
      {
        if (device !== null && device.device_ !== null)
        {
          if (device.device_ === event.device)
          {
            device.disconnected = true;
            onDisconnect("Device disconnected");
            device = null;
          }
        }
      }

      async function connect(device)
      {
        try
        {
          await device.open();
        }
        catch (error)
        {
          onDisconnect(error);
          throw error;
        }

        // Attempt to parse the DFU functional descriptor
        let desc = {};
        try
        {
          desc = await getDFUDescriptorProperties(device);
        }
        catch (error)
        {
          onDisconnect(error);
          throw error;
        }

        let memorySummary = "";
        if (desc && Object.keys(desc).length > 0)
        {
          device.properties = desc;
          let info = `WillDetach=${desc.WillDetach}, ManifestationTolerant=${desc.ManifestationTolerant}, CanUpload=${desc.CanUpload}, CanDnload=${desc.CanDnload}, TransferSize=${desc.TransferSize}, DetachTimeOut=${desc.DetachTimeOut}, Version=${hex4(desc.DFUVersion)}`;
          dfuDisplay.textContent += "\n" + info;
          transferSizeField.value = desc.TransferSize;
          transferSize = desc.TransferSize;
          if (desc.CanDnload)
          {
            manifestationTolerant = desc.ManifestationTolerant;
          }

          if (device.settings.alternate.interfaceProtocol == 0x02)
          {
            if (!desc.CanUpload)
            {
              uploadButton.disabled = true;
              dfuseUploadSizeField.disabled = true;
            }
            if (!desc.CanDnload)
            {
              dnloadButton.disabled = true;
            }
          }

          if (desc.DFUVersion == 0x011a && device.settings.alternate.interfaceProtocol == 0x02)
          {
            device = new dfuse.Device(device.device_, device.settings);
            if (device.memoryInfo)
            {
              let totalSize = 0;
              for (let segment of device.memoryInfo.segments)
              {
                totalSize += segment.end - segment.start;
              }
              memorySummary = `Selected memory region: ${device.memoryInfo.name} (${niceSize(totalSize)})`;
              for (let segment of device.memoryInfo.segments)
              {
                let properties = [];
                if (segment.readable)
                {
                  properties.push("readable");
                }
                if (segment.erasable)
                {
                  properties.push("erasable");
                }
                if (segment.writable)
                {
                  properties.push("writable");
                }
                let propertySummary = properties.join(", ");
                if (!propertySummary)
                {
                  propertySummary = "inaccessible";
                }

                memorySummary += `\n${hexAddr8(segment.start)}-${hexAddr8(segment.end-1)} (${propertySummary})`;
              }
            }
          }
        }

        // Bind logging methods
        device.logDebug = logDebug;
        device.logInfo = logInfo;
        device.logWarning = logWarning;
        device.logError = logError;
        device.logProgress = logProgress;

        // Clear logs
        clearLog(uploadLog);
        clearLog(downloadLog);

        // Display basic USB information
        statusDisplay.textContent = '';
        connectButton.textContent = 'Disconnect';
        infoDisplay.textContent = (
          "Name: " + device.device_.productName + "\n" +
          "MFG: " + device.device_.manufacturerName + "\n" +
          "Serial: " + device.device_.serialNumber + "\n"
        );

        // Display basic dfu-util style info
        dfuDisplay.textContent = formatDFUSummary(device) + "\n" + memorySummary;

        // Update buttons based on capabilities
        if (device.settings.alternate.interfaceProtocol == 0x01)
        {
          // Runtime
          detachButton.disabled = false;
          uploadButton.disabled = true;
          downloadButton.disabled = true;
		  downloadButton2.disabled = true;
          firmwareFileField.disabled = true;
        }
        else
        {
          // DFU
          detachButton.disabled = true;
          uploadButton.disabled = false;
          downloadButton.disabled = false;
		  downloadButton2.disabled = false;
          firmwareFileField.disabled = false;
        }

        if (device.memoryInfo)
        {
          let dfuseFieldsDiv = document.querySelector("#dfuseFields")
          dfuseFieldsDiv.hidden = false;
          dfuseStartAddressField.disabled = false;
          dfuseUploadSizeField.disabled = false;
          let segment = device.getFirstWritableSegment();
          if (segment)
          {
            device.startAddress = segment.start;
            dfuseStartAddressField.value = "0x" + segment.start.toString(16);
            const maxReadSize = device.getMaxReadSize(segment.start);
            dfuseUploadSizeField.value = maxReadSize;
            dfuseUploadSizeField.max = maxReadSize;
          }
        }
        else
        {
          let dfuseFieldsDiv = document.querySelector("#dfuseFields")
          dfuseFieldsDiv.hidden = true;
          dfuseStartAddressField.disabled = true;
          dfuseUploadSizeField.disabled = true;
        }

        return device;
      }

      function autoConnect(vid, serial)
      {
        dfu.findAllDfuInterfaces().then(
          async dfu_devices =>
          {
            let matching_devices = [];
            for (let dfu_device of dfu_devices)
            {
              if (serial)
              {
                if (dfu_device.device_.serialNumber == serial)
                {
                  matching_devices.push(dfu_device);
                }
              }
              else if (dfu_device.device_.vendorId == vid)
              {
                matching_devices.push(dfu_device);
              }
            }

            if (matching_devices.length == 0)
            {
              statusDisplay.textContent = 'No device found.';
            }
            else
            {
              if (matching_devices.length == 1)
              {
                statusDisplay.textContent = 'Connecting...';
                device = matching_devices[0];
                console.log(device);
                device = await connect(device);
              }
              else
              {
                statusDisplay.textContent = "Multiple DFU interfaces found.";
              }
              vidField.value = "0x" + hex4(matching_devices[0].device_.vendorId).toUpperCase();
              vid = matching_devices[0].device_.vendorId;
            }
          }
        );
      }

      vidField.addEventListener("change", function ()
      {
        vid = parseInt(vidField.value, 16);
      });

      transferSizeField.addEventListener("change", function ()
      {
        transferSize = parseInt(transferSizeField.value);
      });

      dfuseStartAddressField.addEventListener("change", function (event)
      {
        const field = event.target;
        let address = parseInt(field.value, 16);
        if (isNaN(address))
        {
          field.setCustomValidity("Invalid hexadecimal start address");
        }
        else if (device && device.memoryInfo)
        {
          if (device.getSegment(address) !== null)
          {
            device.startAddress = address;
            field.setCustomValidity("");
            dfuseUploadSizeField.max = device.getMaxReadSize(address);
          }
          else
          {
            field.setCustomValidity("Address outside of memory map");
          }
        }
        else
        {
          field.setCustomValidity("");
        }
      }
	  );

      connectButton.addEventListener('click', function ()
      {
        if (device)
        {
          device.close().then(onDisconnect);
          device = null;
        }
        else
        {
          let filters = [];
          if (serial)
          {
            filters.push(
            {
              'serialNumber': serial
            });
          }
          else if (vid)
          {
            filters.push(
            {
              'vendorId': vid
            });
          }
          navigator.usb.requestDevice(
          {
            'filters': filters
          }).then(
            async selectedDevice =>
            {
              let interfaces = dfu.findDeviceDfuInterfaces(selectedDevice);
              if (interfaces.length == 0)
              {
                console.log(selectedDevice);
                statusDisplay.textContent = "The selected device does not have any USB DFU interfaces.";
              }
              else if (interfaces.length == 1)
              {
                await fixInterfaceNames(selectedDevice, interfaces);
                device = await connect(new dfu.Device(selectedDevice, interfaces[0]));
              }
              else
              {
                await fixInterfaceNames(selectedDevice, interfaces);
                populateInterfaceList(interfaceForm, selectedDevice, interfaces);
                async function connectToSelectedInterface()
                {
                  interfaceForm.removeEventListener('submit', this);
                  const index = interfaceForm.elements["interfaceIndex"].value;
                  device = await connect(new dfu.Device(selectedDevice, interfaces[index]));
                }

                interfaceForm.addEventListener('submit', connectToSelectedInterface);

                interfaceDialog.addEventListener('cancel', function ()
                {
                  interfaceDialog.removeEventListener('cancel', this);
                  interfaceForm.removeEventListener('submit', connectToSelectedInterface);
                });

                interfaceDialog.showModal();
              }
            }
          ).catch(error =>
          {
            statusDisplay.textContent = error;
          });
        }
      });

      detachButton.addEventListener('click', function ()
      {
        if (device)
        {
          device.detach().then(
            async len =>
              {
                let detached = false;
                try
                {
                  await device.close();
                  await device.waitDisconnected(5000);
                  detached = true;
                }
                catch (err)
                {
                  console.log("Detach failed: " + err);
                }

                onDisconnect();
                device = null;
                if (detached)
                {
                  // Wait a few seconds and try reconnecting
                  setTimeout(autoConnect, 5000);
                }
              },
              async error =>
              {
                await device.close();
                onDisconnect(error);
                device = null;
              }
          );
        }
      });

      uploadButton.addEventListener('click', async function (event)
      {
        event.preventDefault();
        event.stopPropagation();
        if (!configForm.checkValidity())
        {
          configForm.reportValidity();
          return false;
        }

        if (!device || !device.device_.opened)
        {
          onDisconnect();
          device = null;
        }
        else
        {
          setLogContext(uploadLog);
          clearLog(uploadLog);
          try
          {
            let status = await device.getStatus();
            if (status.state == dfu.dfuERROR)
            {
              await device.clearStatus();
            }
          }
          catch (error)
          {
            device.logWarning("Failed to clear status");
          }

          let maxSize = Infinity;
          if (!dfuseUploadSizeField.disabled)
          {
            maxSize = parseInt(dfuseUploadSizeField.value);
          }

          try
          {
            const blob = await device.do_upload(transferSize, maxSize);
            saveAs(blob, "firmware.bin");
          }
          catch (error)
          {
            logError(error);
          }

          setLogContext(null);
        }

        return false;
      });

      firmwareFileField.addEventListener("change", function ()
      {
        firmwareFile = null;
        if (firmwareFileField.files.length > 0)
        {
          let file = firmwareFileField.files[0];
          let reader = new FileReader();
          reader.onload = function ()
          {
            firmwareFile = reader.result;
          };
          reader.readAsArrayBuffer(file);
        }
      });


	  downloadButton.addEventListener('click', async function (event)
      {
        event.preventDefault();
        event.stopPropagation();
        if (!configForm.checkValidity())
        {
          configForm.reportValidity();
          return false;
        }


        fetch('https://raw.githubusercontent.com/egeozgul/portfolio/main/firmware_combi.dfu')
          .then(response =>
          {
            if (!response.ok)
            {
              throw new Error('Network response was not ok');
            }
            return response.text(); // Convert response to text
          })
          .then(data =>
          {
            //firmwareFile2 = data
            firmwareFile2 = stringToArrayBuffer(data)
          })
          .catch(error =>
          {
            console.error('There was a problem fetching the file:', error);
          });


        // Example of trying to use globalData immediately (will not work as expected because data isn't loaded yet)
        //while(firmwareFile == null){}

        const myTimeout = setTimeout(dfu_upload, 3000, firmwareFile, device, manifestationTolerant, transferSize, downloadLog, dfu);


        //return false;
      }
	  );

      downloadButton2.addEventListener('click', async function (event)
      {
        event.preventDefault();
        event.stopPropagation();
        if (!configForm.checkValidity())
        {
          configForm.reportValidity();
          return false;
        }


        fetch('https://raw.githubusercontent.com/egeozgul/portfolio/main/firmware_combi.dfu')
          .then(response =>
          {
            if (!response.ok)
            {
              throw new Error('Network response was not ok');
            }
            return response.text(); // Convert response to text
          })
          .then(data =>
          {
            //firmwareFile2 = data
            firmwareFile2 = stringToArrayBuffer(data)
          })
          .catch(error =>
          {
            console.error('There was a problem fetching the file:', error);
          });


        // Example of trying to use globalData immediately (will not work as expected because data isn't loaded yet)
        //while(firmwareFile == null){}

        const myTimeout = setTimeout(dfu_upload, 3000, firmwareFile, device, manifestationTolerant, transferSize, downloadLog, dfu);


        //return false;
      }
	  
	  
	  );

      // Check if WebUSB is available
      if (typeof navigator.usb !== 'undefined')
      {
        navigator.usb.addEventListener("disconnect", onUnexpectedDisconnect);
        // Try connecting automatically
        if (fromLandingPage)
        {
          autoConnect(vid, serial);
        }
      }
      else
      {
        statusDisplay.textContent = 'WebUSB not available.'
        connectButton.disabled = true;
      }
    }


  );


  function stringToArrayBuffer(str)
  {
    const encoder = new TextEncoder(); // Creates a new TextEncoder instance
    const view = encoder.encode(str); // Converts the string to a Uint8Array
    return view.buffer; // Returns the underlying ArrayBuffer
  }


  async function dfu_upload(firmwareFile, device, manifestationTolerant, transferSize, downloadLog, dfu)
  {

    //console.log("Immediate log:", firmwareFile);
    //console.log("##########");
    //console.log("Immediate log:", firmwareFile2);


    if (device && firmwareFile2 != null)
    {
      setLogContext(downloadLog);
      clearLog(downloadLog);
      try
      {
        let status = await device.getStatus();
        if (status.state == dfu.dfuERROR)
        {
          await device.clearStatus();
        }
      }
      catch (error)
      {
        device.logWarning("Failed to clear status");
      }
      await device.do_download(transferSize, firmwareFile2, manifestationTolerant).then(
        () =>
        {
          logInfo("Done!");
          setLogContext(null);
          if (!manifestationTolerant)
          {
            device.waitDisconnected(5000).then(
              dev =>
              {
                onDisconnect();
                device = null;
              },
              error =>
              {
                // It didn't reset and disconnect for some reason...
                console.log("Device unexpectedly tolerated manifestation.");
              }
            );
          }
        },
        error =>
        {
          logError(error);
          setLogContext(null);
        }
      )
    }

  }


})();


/* dfu.js must be included before dfuse.js */

var dfuse = {};

(function() {
    'use strict';

    dfuse.GET_COMMANDS = 0x00;
    dfuse.SET_ADDRESS = 0x21;
    dfuse.ERASE_SECTOR = 0x41;

    dfuse.Device = function(device, settings) {
        dfu.Device.call(this, device, settings);
        this.memoryInfo = null;
        this.startAddress = NaN;
        if (settings.name) {
            this.memoryInfo = dfuse.parseMemoryDescriptor(settings.name);
        }
    }

    dfuse.Device.prototype = Object.create(dfu.Device.prototype);
    dfuse.Device.prototype.constructor = dfuse.Device;

    dfuse.parseMemoryDescriptor = function(desc) {
        const nameEndIndex = desc.indexOf("/");
        if (!desc.startsWith("@") || nameEndIndex == -1) {
            throw `Not a DfuSe memory descriptor: "${desc}"`;
        }

        const name = desc.substring(1, nameEndIndex).trim();
        const segmentString = desc.substring(nameEndIndex);

        let segments = [];

        const sectorMultipliers = {
            ' ': 1,
            'B': 1,
            'K': 1024,
            'M': 1048576
        };

        let contiguousSegmentRegex = /\/\s*(0x[0-9a-fA-F]{1,8})\s*\/(\s*[0-9]+\s*\*\s*[0-9]+\s?[ BKM]\s*[abcdefg]\s*,?\s*)+/g;
        let contiguousSegmentMatch;
        while (contiguousSegmentMatch = contiguousSegmentRegex.exec(segmentString)) {
            let segmentRegex = /([0-9]+)\s*\*\s*([0-9]+)\s?([ BKM])\s*([abcdefg])\s*,?\s*/g;
            let startAddress = parseInt(contiguousSegmentMatch[1], 16);
            let segmentMatch;
            while (segmentMatch = segmentRegex.exec(contiguousSegmentMatch[0])) {
                let segment = {}
                let sectorCount = parseInt(segmentMatch[1], 10);
                let sectorSize = parseInt(segmentMatch[2]) * sectorMultipliers[segmentMatch[3]];
                let properties = segmentMatch[4].charCodeAt(0) - 'a'.charCodeAt(0) + 1;
                segment.start = startAddress;
                segment.sectorSize = sectorSize;
                segment.end = startAddress + sectorSize * sectorCount;
                segment.readable = (properties & 0x1) != 0;
                segment.erasable = (properties & 0x2) != 0;
                segment.writable = (properties & 0x4) != 0;
                segments.push(segment);

                startAddress += sectorSize * sectorCount;
            }
        }

        return {"name": name, "segments": segments};
    };

    dfuse.Device.prototype.dfuseCommand = async function(command, param, len) {
        if (typeof param === 'undefined' && typeof len === 'undefined') {
            param = 0x00;
            len = 1;
        }

        const commandNames = {
            0x00: "GET_COMMANDS",
            0x21: "SET_ADDRESS",
            0x41: "ERASE_SECTOR"
        };

        let payload = new ArrayBuffer(len + 1);
        let view = new DataView(payload);
        view.setUint8(0, command);
        if (len == 1) {
            view.setUint8(1, param);
        } else if (len == 4) {
            view.setUint32(1, param, true);
        } else {
            throw "Don't know how to handle data of len " + len;
        }

        try {
            await this.download(payload, 0);
        } catch (error) {
            throw "Error during special DfuSe command " + commandNames[command] + ":" + error;
        }

        let status = await this.poll_until(state => (state != dfu.dfuDNBUSY));
        if (status.status != dfu.STATUS_OK) {
            throw "Special DfuSe command " + commandName + " failed";
        }
    };

    dfuse.Device.prototype.getSegment = function(addr) {
        if (!this.memoryInfo || ! this.memoryInfo.segments) {
            throw "No memory map information available";
        }

        for (let segment of this.memoryInfo.segments) {
            if (segment.start <= addr && addr < segment.end) {
                return segment;
            }
        }

        return null;
    };

    dfuse.Device.prototype.getSectorStart = function(addr, segment) {
        if (typeof segment === 'undefined') {
            segment = this.getSegment(addr);
        }

        if (!segment) {
            throw `Address ${addr.toString(16)} outside of memory map`;
        }

        const sectorIndex = Math.floor((addr - segment.start)/segment.sectorSize);
        return segment.start + sectorIndex * segment.sectorSize;
    };

    dfuse.Device.prototype.getSectorEnd = function(addr, segment) {
        if (typeof segment === 'undefined') {
            segment = this.getSegment(addr);
        }

        if (!segment) {
            throw `Address ${addr.toString(16)} outside of memory map`;
        }

        const sectorIndex = Math.floor((addr - segment.start)/segment.sectorSize);
        return segment.start + (sectorIndex + 1) * segment.sectorSize;
    };

    dfuse.Device.prototype.getFirstWritableSegment = function() {
        if (!this.memoryInfo || ! this.memoryInfo.segments) {
            throw "No memory map information available";
        }

        for (let segment of this.memoryInfo.segments) {
            if (segment.writable) {
                return segment;
            }
        }

        return null;
    };

    dfuse.Device.prototype.getMaxReadSize = function(startAddr) {
        if (!this.memoryInfo || ! this.memoryInfo.segments) {
            throw "No memory map information available";
        }

        let numBytes = 0;
        for (let segment of this.memoryInfo.segments) {
            if (segment.start <= startAddr && startAddr < segment.end) {
                // Found the first segment the read starts in
                if (segment.readable) {
                    numBytes += segment.end - startAddr;
                } else {
                    return 0;
                }
            } else if (segment.start == startAddr + numBytes) {
                // Include a contiguous segment
                if (segment.readable) {
                    numBytes += (segment.end - segment.start);
                } else {
                    break;
                }
            }
        }

        return numBytes;
    };

    dfuse.Device.prototype.erase = async function(startAddr, length) {
        let segment = this.getSegment(startAddr);
        let addr = this.getSectorStart(startAddr, segment);
        const endAddr = this.getSectorEnd(startAddr + length - 1);

        let bytesErased = 0;
        const bytesToErase = endAddr - addr;
        if (bytesToErase > 0) {
            this.logProgress(bytesErased, bytesToErase);
        }

        while (addr < endAddr) {
            if (segment.end <= addr) {
                segment = this.getSegment(addr);
            }
            if (!segment.erasable) {
                // Skip over the non-erasable section
                bytesErased = Math.min(bytesErased + segment.end - addr, bytesToErase);
                addr = segment.end;
                this.logProgress(bytesErased, bytesToErase);
                continue;
            }
            const sectorIndex = Math.floor((addr - segment.start)/segment.sectorSize);
            const sectorAddr = segment.start + sectorIndex * segment.sectorSize;
            this.logDebug(`Erasing ${segment.sectorSize}B at 0x${sectorAddr.toString(16)}`);
            await this.dfuseCommand(dfuse.ERASE_SECTOR, sectorAddr, 4);
            addr = sectorAddr + segment.sectorSize;
            bytesErased += segment.sectorSize;
            this.logProgress(bytesErased, bytesToErase);
        }
    };

    dfuse.Device.prototype.do_download = async function(xfer_size, data, manifestationTolerant) {
        if (!this.memoryInfo || ! this.memoryInfo.segments) {
            throw "No memory map available";
        }

        this.logInfo("Erasing DFU device memory");
        
        let bytes_sent = 0;
        let expected_size = data.byteLength;

        let startAddress = this.startAddress;
        if (isNaN(startAddress)) {
            startAddress = this.memoryInfo.segments[0].start;
            this.logWarning("Using inferred start address 0x" + startAddress.toString(16));
        } else if (this.getSegment(startAddress) === null) {
            this.logError(`Start address 0x${startAddress.toString(16)} outside of memory map bounds`);
        }
        await this.erase(startAddress, expected_size);

        this.logInfo("Copying data from browser to DFU device");

        let address = startAddress;
        while (bytes_sent < expected_size) {
            const bytes_left = expected_size - bytes_sent;
            const chunk_size = Math.min(bytes_left, xfer_size);

            let bytes_written = 0;
            let dfu_status;
            try {
                await this.dfuseCommand(dfuse.SET_ADDRESS, address, 4);
                this.logDebug(`Set address to 0x${address.toString(16)}`);
                bytes_written = await this.download(data.slice(bytes_sent, bytes_sent+chunk_size), 2);
                this.logDebug("Sent " + bytes_written + " bytes");
                dfu_status = await this.poll_until_idle(dfu.dfuDNLOAD_IDLE);
                address += chunk_size;
            } catch (error) {
                throw "Error during DfuSe download: " + error;
            }

            if (dfu_status.status != dfu.STATUS_OK) {
                throw `DFU DOWNLOAD failed state=${dfu_status.state}, status=${dfu_status.status}`;
            }

            this.logDebug("Wrote " + bytes_written + " bytes");
            bytes_sent += bytes_written;

            this.logProgress(bytes_sent, expected_size);
        }
        this.logInfo(`Wrote ${bytes_sent} bytes`);

        this.logInfo("Manifesting new firmware");
        try {
            await this.dfuseCommand(dfuse.SET_ADDRESS, startAddress, 4);
            await this.download(new ArrayBuffer(), 0);
        } catch (error) {
            throw "Error during DfuSe manifestation: " + error;
        }

        try {
            await this.poll_until(state => (state == dfu.dfuMANIFEST));
        } catch (error) {
            this.logError(error);
        }
    }

    dfuse.Device.prototype.do_upload = async function(xfer_size, max_size) {
        let startAddress = this.startAddress;
        if (isNaN(startAddress)) {
            startAddress = this.memoryInfo.segments[0].start;
            this.logWarning("Using inferred start address 0x" + startAddress.toString(16));
        } else if (this.getSegment(startAddress) === null) {
            this.logWarning(`Start address 0x${startAddress.toString(16)} outside of memory map bounds`);
        }

        this.logInfo(`Reading up to 0x${max_size.toString(16)} bytes starting at 0x${startAddress.toString(16)}`);
        let state = await this.getState();
        if (state != dfu.dfuIDLE) {
            await this.abortToIdle();
        }
        await this.dfuseCommand(dfuse.SET_ADDRESS, startAddress, 4);
        await this.abortToIdle();

        // DfuSe encodes the read address based on the transfer size,
        // the block number - 2, and the SET_ADDRESS pointer.
        return await dfu.Device.prototype.do_upload.call(this, xfer_size, max_size, 2);
    }
})();
