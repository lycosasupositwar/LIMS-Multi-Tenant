#!/bin/bash
sed -i '/const doc = new Docxtemplater(zip, {/i \
          // Fix for textboxes duplicating tags in Word due to mc:Fallback\
          zip.file(/\\.xml$/).forEach((f: any) => {\
            const content = f.asText();\
            if (content.includes("mc:Fallback")) {\
              const cleanContent = content.replace(/<mc:Fallback(?:[^>]*)>[\\s\\S]*?<\\/mc:Fallback>/g, "");\
              zip.file(f.name, cleanContent);\
            }\
          });\
' src/components/ReportPreviewModal.tsx

sed -i '/const doc = new Docxtemplater(zip, {/i \
          // Fix for textboxes duplicating tags in Word due to mc:Fallback\
          zip.file(/\\.xml$/).forEach((f: any) => {\
            const content = f.asText();\
            if (content.includes("mc:Fallback")) {\
              const cleanContent = content.replace(/<mc:Fallback(?:[^>]*)>[\\s\\S]*?<\\/mc:Fallback>/g, "");\
              zip.file(f.name, cleanContent);\
            }\
          });\
' src/views/Reports.tsx
