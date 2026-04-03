const fs = require('fs');
const file = 'd:/AUTO OSC Updated/src/app/components/AddTaskPanel.tsx';
let content = fs.readFileSync(file, 'utf8');
let badStart = content.indexOf('{/* Modal Actions (Right) */}');
let badEnd = content.indexOf('{!isWorkspace && (');

if (badStart !== -1 && badEnd !== -1) {
    let before = content.slice(0, badStart);
    let after = content.slice(badEnd);
    let fixed = `{/* Modal Actions (Right) */}
            <div className="flex items-center gap-[6px]">
              <button
                className="flex items-center justify-center hover:bg-[rgba(255,255,255,0.05)] transition-colors rounded"
                style={{
                  height: PANEL_BUTTON_HEIGHT,
                  padding: "0 14px",
                  backgroundColor: "transparent",
                  fontSize: 12,
                  color: P.text50,
                }}
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                className="flex items-center justify-center hover:bg-[rgba(255,255,255,0.05)] transition-colors rounded"
                style={{
                  height: PANEL_BUTTON_HEIGHT,
                  padding: "0 14px",
                  backgroundColor: P.surface700,
                  border: \`1px solid \${P.surface600}\`,
                  fontSize: 12,
                  color: P.text50,
                }}
                onClick={handleApplyAndClose}
              >
                Apply & Close
              </button>
              <button
                className="flex items-center justify-center transition-colors hover:brightness-110 rounded"
                style={{
                  height: PANEL_BUTTON_HEIGHT,
                  padding: "0 16px",
                  backgroundColor: PURPLE_ACCENT_BG,
                  border: \`1px solid \${PURPLE_ACCENT_BORDER}\`,
                  fontSize: 12,
                  fontWeight: 500,
                  color: PURPLE_ACCENT_TEXT,
                }}
                onClick={handleSave}
              >
                Apply Changes
              </button>
            </div>
          </div>
        ) : null}
        `;
    fs.writeFileSync(file, before + fixed + after);
    console.log('Fixed!');
} else {
    console.log('Not found', badStart, badEnd);
}
