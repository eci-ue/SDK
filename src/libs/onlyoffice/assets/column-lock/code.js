(function (window) {
	"use strict";

	var MAX_COLUMN_NUMBER = 16384; // XFD
	var MAX_ROW_NUMBER = 1048576;
	var PLUGIN_GUID = "asc.{98CBCAA1-3113-4A12-AE5F-2B6801F71F3C}";
	var titlePrefix = "列禁用-";
	var isApplying = false;
	var hasApplied = false;
	var retryCount = 0;
	var retryTimer;

	function columnNumber(column) {
		var result = 0;
		var i;

		for (i = 0; i < column.length; i += 1) {
			result = result * 26 + column.charCodeAt(i) - 64;
		}

		return result;
	}

	function parseColumns(value) {
		var items = Array.isArray(value) ? value : String(value || "").split(",");
		var result = [];
		var seen = {};
		var i;

		for (i = 0; i < items.length; i += 1) {
			var item = String(items[i] || "").toUpperCase().trim();
			if (!item) {
				continue;
			}

			var match = /^([A-Z]{1,3})(?::([A-Z]{1,3}))?$/.exec(item);
			if (!match || columnNumber(match[1]) > MAX_COLUMN_NUMBER ||
				(match[2] && columnNumber(match[2]) > MAX_COLUMN_NUMBER)) {
				throw new Error("列范围格式不正确：" + item);
			}

			if (match[2] && columnNumber(match[1]) > columnNumber(match[2])) {
				throw new Error("连续列的起始列不能大于结束列：" + item);
			}

			if (!seen[item]) {
				result.push({start: match[1], end: match[2] || match[1], label: item});
				seen[item] = true;
			}
		}

		if (!result.length) {
			throw new Error("请至少输入一个列范围。");
		}

		return result;
	}

	function getLockedColumns() {
		var options = window.Asc.plugin.info && window.Asc.plugin.info.options;
		if (typeof options === "string") {
			try {
				options = JSON.parse(options);
			} catch (error) {
				console.warn("[column-lock] Invalid plugin options JSON.");
				return [];
			}
		}

		// Current editors provide the options object for this plugin directly.
		// The keyed fallback supports integrations that pass the complete map.
		if (options && options[PLUGIN_GUID]) {
			options = options[PLUGIN_GUID];
		}
		var columns = options && (options.lockedColumns || options.columns);

		try {
			return parseColumns(columns);
		} catch (error) {
			console.warn("[column-lock] Ignore invalid lockedColumns option:", error.message);
			return [];
		}
	}

	function lockColumns(columns) {
		window.Asc.scope.columnsToLock = columns;
		window.Asc.scope.protectionTitlePrefix = titlePrefix;
		window.Asc.scope.maxRowNumber = MAX_ROW_NUMBER;

		window.Asc.plugin.callCommand(function () {
			try {
				var worksheet = Api.GetActiveSheet();
				if (!worksheet) {
					return JSON.stringify({error: "WORKSHEET_NOT_READY"});
				}

				var worksheetName = worksheet.GetName();
				var sheetReference = "'" + worksheetName.replace(/'/g, "''") + "'!";
				var applied = [];
				var revokedUsers = [];
				var i;

				for (i = 0; i < Asc.scope.columnsToLock.length; i += 1) {
					var item = Asc.scope.columnsToLock[i];
					var title = Asc.scope.protectionTitlePrefix + item.label;
					var range = sheetReference + "$" + item.start + "$1:$" + item.end + "$" + Asc.scope.maxRowNumber;
					var protectedRange = worksheet.GetProtectedRange(title);

					if (protectedRange) {
						protectedRange.SetRange(range);
					} else {
						protectedRange = worksheet.AddProtectedRange(title, range);
					}

					if (protectedRange) {
						protectedRange.SetAnyoneType("CanView");
						var users = protectedRange.GetAllUsers() || [];
						var j;
						for (j = 0; j < users.length; j += 1) {
							var userId = users[j].GetId();
							if (userId && protectedRange.DeleteUser(userId)) {
								revokedUsers.push(userId);
							}
						}
						applied.push(item.label);
					}
				}

				return JSON.stringify({applied: applied, revokedUsers: revokedUsers});
			} catch (error) {
				return JSON.stringify({error: String(error)});
			}
		}, false, true, function (result) {
			var data;
			try {
				data = typeof result === "string" ? JSON.parse(result) : result;
			} catch (error) {
				data = {error: "INVALID_COMMAND_RESULT"};
			}

			isApplying = false;
			if (data && data.applied && data.applied.length) {
				hasApplied = true;
				console.info("[column-lock] Protected columns:", data.applied.join(","));
				console.info("[column-lock] Revoked explicit editors:", (data.revokedUsers || []).join(",") || "none");
			} else {
				console.warn("[column-lock] Protection was not applied:", data && data.error);
				if (data && data.error === "WORKSHEET_NOT_READY") {
					scheduleRetry();
				}
			}
		});
	}

	function scheduleRetry() {
		clearTimeout(retryTimer);
		if (retryCount >= 3 || hasApplied) {
			return;
		}

		retryCount += 1;
		retryTimer = setTimeout(applyProtection, retryCount * 500);
	}

	function applyProtection() {
		if (isApplying || hasApplied) {
			return;
		}

		var columns = getLockedColumns();
		if (!columns.length) {
			return;
		}

		isApplying = true;
		lockColumns(columns);
	}

	window.Asc.plugin.init = function () {
		// Protection starts only after the editor reports a usable document.
		window.Asc.plugin.event_onDocumentContentReady = applyProtection;
		// Fallback for editor versions that initialize this system plugin after
		// the document-ready event has already been dispatched.
		retryTimer = setTimeout(applyProtection, 1500);
	};
})(window);
