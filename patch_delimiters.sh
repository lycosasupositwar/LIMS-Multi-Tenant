#!/bin/bash
sed -i '/linebreaks: true,/a \            delimiters: { start: "{{", end: "}}" },' src/components/ReportPreviewModal.tsx
sed -i '/linebreaks: true,/a \            delimiters: { start: "{{", end: "}}" },' src/views/Reports.tsx
