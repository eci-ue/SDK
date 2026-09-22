(function (window) {
	"use strict";

	var helper;
	var showTimer;
	var repositionTimer;
	var suppressUntil = 0;
	var displayedMonth;
	var selectionRequest = 0;
	var dateNumberFormat = "yyyy/mm/dd";
	var lastEditorClick = {address: "", time: 0};
	var pickerTargetAddress = "";
	var usesAttachedEditorEvents = false;
	var helperWidth = 270;
	var helperHeight = 260;

	function toDateString(date) {
		var year = date.getFullYear();
		var month = String(date.getMonth() + 1).padStart(2, "0");
		var day = String(date.getDate()).padStart(2, "0");
		return year + "-" + month + "-" + day;
	}

	function getCalendarElements() {
		var days = document.getElementById("days");
		var monthLabel = document.getElementById("month-label");

		if (days && monthLabel) {
			return {days: days, monthLabel: monthLabel};
		}

		// InputHelper creates its window by replacing the plugin body. Build the
		// calendar after that step so it is present in the positioned iframe.
		document.body.innerHTML = [
			'<main class="calendar" aria-label="日期选择">',
			'  <header class="calendar__header">',
			'    <button type="button" class="calendar__nav" data-action="previous" aria-label="上个月">‹</button>',
			'    <strong id="month-label"></strong>',
			'    <button type="button" class="calendar__nav" data-action="next" aria-label="下个月">›</button>',
			'  </header>',
			'  <div class="calendar__weekdays" aria-hidden="true">',
			'    <span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span>',
			'  </div>',
			'  <div id="days" class="calendar__days"></div>',
			'  <footer class="calendar__footer">',
			'    <button type="button" class="calendar__today" data-action="today">今天</button>',
			'  </footer>',
			'</main>',
		].join("");

		return {
			days: document.getElementById("days"),
			monthLabel: document.getElementById("month-label"),
		};
	}

	function renderCalendar() {
		var elements = getCalendarElements();
		var days = elements.days;
		var monthLabel = elements.monthLabel;
		var firstDay = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth(), 1);
		var daysInMonth = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() + 1, 0).getDate();
		var today = toDateString(new Date());
		var html = [];
		var i;

		monthLabel.textContent = displayedMonth.getFullYear() + " 年 " + (displayedMonth.getMonth() + 1) + " 月";

		for (i = 0; i < firstDay.getDay(); i += 1) {
			html.push('<span class="calendar__empty"></span>');
		}

		for (i = 1; i <= daysInMonth; i += 1) {
			var value = toDateString(new Date(displayedMonth.getFullYear(), displayedMonth.getMonth(), i));
			var classes = "calendar__day" + (value === today ? " calendar__day--today" : "");
			html.push('<button type="button" class="' + classes + '" data-date="' + value + '">' + i + "</button>");
		}

		days.innerHTML = html.join("");
	}

	function isDateFormat(format) {
		if (typeof format !== "string") {
			return false;
		}

		var value = format.toLowerCase().trim();
		if (!value) {
			return false;
		}

		if (value === "dateshort" || value === "datelong" || value.indexOf("date") !== -1) {
			return true;
		}

		// Remove locale/color directives and quoted display text before detecting
		// Excel/OnlyOffice date tokens. A month token alone is ambiguous with time,
		// so require a year/day token or a Chinese date unit.
		var mask = value
			.replace(/\[[^\]]*]/g, "")
			.replace(/"[^"]*"/g, "")
			.replace(/\\./g, "");

		return /[yd]/.test(mask) || /[年月日]/.test(value);
	}

	function hideDatePicker() {
		if (helper) {
			helper.unShow();
		}
	}

	function showDatePicker(requestId) {
		if (!helper || Date.now() < suppressUntil || requestId !== selectionRequest) {
			return;
		}

		// Wait for the editor to finish applying the new target position before
		// showing the helper. Showing it from the click callback can use the
		// previous position (0, 0), especially on the first click.
		clearTimeout(repositionTimer);
		repositionTimer = setTimeout(function () {
			if (!helper || Date.now() < suppressUntil || requestId !== selectionRequest) {
				return;
			}

			// Keep the original calendar size so all date buttons remain available,
			// while leaving keyboard capture disabled for reliable mouse clicks.
			helper.show(helperWidth, helperHeight, false);
		}, 0);
	}

	function checkActiveCellFormat(requestId, verificationAttempt) {
		if (!helper || Date.now() < suppressUntil || requestId !== selectionRequest) {
			return;
		}

		window.Asc.plugin.callCommand(function () {
			var worksheet = Api.GetActiveSheet();
			var activeCell = worksheet && worksheet.GetActiveCell();
			if (!activeCell) {
				return null;
			}

			return {
				address: activeCell.GetAddress(),
				format: activeCell.GetNumberFormat(),
			};
		}, false, false, function (cellInfo) {
			if (requestId !== selectionRequest) {
				return;
			}
			if (cellInfo && isDateFormat(cellInfo.format)) {
				// A spreadsheet click and the plugin command queue can complete in
				// different orders. Confirm the format once more before opening so a
				// stale date-cell result cannot reopen the helper on another cell.
				if (verificationAttempt !== 1) {
					clearTimeout(showTimer);
					showTimer = setTimeout(function () {
						checkActiveCellFormat(requestId, 1);
					}, 32);
					return;
				}
				pickerTargetAddress = cellInfo.address || pickerTargetAddress;
				showDatePicker(requestId);
			} else {
				hideDatePicker();
			}
		});
	}

	function scheduleDatePicker(delay) {
		clearTimeout(showTimer);
		clearTimeout(repositionTimer);
		var requestId = ++selectionRequest;
		hideDatePicker();
		showTimer = setTimeout(function () {
			checkActiveCellFormat(requestId, 0);
		}, typeof delay === "number" ? delay : 0);
	}

	function handleExternalMouseUp() {
		// The spreadsheet is outside the plugin iframe. Hide immediately when
		// the user releases the mouse there; the selection/click handlers will
		// decide whether a new date helper should be shown.
		hideDatePicker();
	}

	function clearDateCellContent() {
		window.Asc.plugin.callCommand(function () {
			var worksheet = Api.GetActiveSheet();
			var activeCell = worksheet && worksheet.GetActiveCell();

			if (!activeCell) {
				return false;
			}

			// Clear the value while preserving the cell's date format and styling.
			activeCell.SetValue("");
			return true;
		}, false, true, function (result) {
			if (result !== true) {
				console.error("日期单元格清空失败", result);
			}
		});
	}

	function handleEditorClick() {
		// Re-anchor the input helper on every spreadsheet click. Otherwise,
		// ONLYOFFICE may keep the previous cell's popup position after selection
		// changes.
		// Invalidate the current request immediately so a pending date-cell query
		// cannot reopen the popup after the user clicks a non-date cell.
		scheduleDatePicker(16);
		var clickTime = Date.now();

		window.Asc.plugin.callCommand(function () {
			var worksheet = Api.GetActiveSheet();
			var activeCell = worksheet && worksheet.GetActiveCell();

			if (!activeCell) {
				return null;
			}

			return {
				address: activeCell.GetAddress(),
				format: activeCell.GetNumberFormat(),
			};
		}, false, false, function (cellInfo) {
			if (!cellInfo || !isDateFormat(cellInfo.format)) {
				lastEditorClick = {address: "", time: 0};
				return;
			}

			var isDoubleClick = cellInfo.address === lastEditorClick.address &&
				clickTime - lastEditorClick.time <= 450;

			if (isDoubleClick) {
				lastEditorClick = {address: "", time: 0};
				clearDateCellContent();
				return;
			}

			lastEditorClick = {address: cellInfo.address, time: clickTime};
		});
	}

	window.Asc.plugin.init = function () {
		window.Asc.plugin.createInputHelper();
		helper = window.Asc.plugin.getInputHelper();
		helper.createWindow();
		displayedMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
		renderCalendar();

		// Create the host-side helper window before the first real interaction.
		// The first ShowInputHelper call otherwise includes iframe/window setup
		// and can briefly use the default (top-left) position.
		helper.show(helperWidth, helperHeight, false);
		helper.unShow();

		usesAttachedEditorEvents = typeof window.Asc.plugin.attachEditorEvent === "function";
		if (usesAttachedEditorEvents) {
			window.Asc.plugin.attachEditorEvent("onTargetPositionChanged", scheduleDatePicker);
			window.Asc.plugin.attachEditorEvent("onClick", handleEditorClick);
			window.Asc.plugin.attachEditorEvent("onExternalMouseUp", handleExternalMouseUp);
		} else {
			// Used by ONLYOFFICE versions before attachEditorEvent was introduced.
			window.Asc.plugin.event_onTargetPositionChanged = scheduleDatePicker;
			window.Asc.plugin.event_onClick = handleEditorClick;
			window.Asc.plugin.event_onExternalMouseUp = handleExternalMouseUp;
		}
	};

	function toExcelSerial(value) {
		var parts = String(value).split("-");
		if (parts.length !== 3) {
			return null;
		}

		var year = Number(parts[0]);
		var month = Number(parts[1]);
		var day = Number(parts[2]);
		var dateUTC = Date.UTC(year, month - 1, day);
		var date = new Date(dateUTC);

		if (!Number.isFinite(dateUTC) ||
			date.getUTCFullYear() !== year ||
			date.getUTCMonth() !== month - 1 ||
			date.getUTCDate() !== day) {
			return null;
		}

		// OnlyOffice/Excel stores a date as the number of days since 1899-12-30.
		return Math.floor((dateUTC - Date.UTC(1899, 11, 30)) / 86400000);
	}

	function selectDate(value) {
		suppressUntil = Date.now() + 300;
		var dateValue = toExcelSerial(value);
		if (dateValue === null) {
			return;
		}

		window.Asc.scope.dateValue = dateValue;
		window.Asc.scope.numberFormat = dateNumberFormat;
		window.Asc.scope.targetAddress = pickerTargetAddress;

		// Follow the official Datepicker plugin: write a numeric Excel date from
		// inside callCommand, and apply it to the current selection/cell.
		window.Asc.plugin.callCommand(function () {
			var worksheet = Api.GetActiveSheet();
			var targetAddress = Asc.scope.targetAddress;
			var target = targetAddress && worksheet && typeof worksheet.GetRange === "function"
				? worksheet.GetRange(targetAddress)
				: null;
			var selection = worksheet && worksheet.GetSelection();
			target = target || selection || (worksheet && worksheet.GetActiveCell());
			var valueToWrite = Asc.scope.dateValue;
			var numberFormat = Asc.scope.numberFormat;

			if (!target) {
				return false;
			}

			function writeCell(cell) {
				// Clear the previous value first. This matches the official plugin
				// behavior and also replaces cells that contain text or an old date.
				cell.Clear();
				if (numberFormat && numberFormat !== "General" && numberFormat !== "@") {
					cell.SetNumberFormat(numberFormat);
				}
				cell.SetValue(valueToWrite);
			}

			if (typeof target.ForEach === "function") {
				target.ForEach(writeCell);
			} else {
				writeCell(target);
			}

			return true;
		}, false, true, function (result) {
			if (result !== true) {
				console.error("日期写入单元格失败", result);
			}
			helper.unShow();
			pickerTargetAddress = "";
		});

		// callCommand serializes Asc.scope when it is invoked, so it is safe to
		// remove these temporary values immediately after dispatching the command.
		delete window.Asc.scope.dateValue;
		delete window.Asc.scope.numberFormat;
		delete window.Asc.scope.targetAddress;
	}

  document.addEventListener("click", function (event) {
		var target = event.target.closest("[data-action], [data-date]");
		if (!target) {
			return;
		}

		if (target.dataset.action === "previous") {
			displayedMonth.setMonth(displayedMonth.getMonth() - 1);
			renderCalendar();
		} else if (target.dataset.action === "next") {
			displayedMonth.setMonth(displayedMonth.getMonth() + 1);
			renderCalendar();
		} else if (target.dataset.action === "today") {
			selectDate(toDateString(new Date()));
		} else if (target.dataset.date) {
			selectDate(target.dataset.date);
		}
  });

  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape") {
      return;
    }

    clearTimeout(showTimer);
    selectionRequest += 1;
    hideDatePicker();
    event.preventDefault();
    event.stopPropagation();
  });

	window.Asc.plugin.onDestroy = function () {
		clearTimeout(showTimer);
		clearTimeout(repositionTimer);
		selectionRequest += 1;
		if (usesAttachedEditorEvents && typeof window.Asc.plugin.detachEditorEvent === "function") {
			window.Asc.plugin.detachEditorEvent("onTargetPositionChanged");
			window.Asc.plugin.detachEditorEvent("onClick");
			window.Asc.plugin.detachEditorEvent("onExternalMouseUp");
		}
	};
})(window);
