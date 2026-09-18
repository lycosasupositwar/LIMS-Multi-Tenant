#!/bin/bash
sed -i '/\/\/ Fix for textboxes duplicating tags in Word due to mc:Fallback/,/});/d' src/components/ReportPreviewModal.tsx
sed -i '/\/\/ Fix for textboxes duplicating tags in Word due to mc:Fallback/,/});/d' src/views/Reports.tsx
