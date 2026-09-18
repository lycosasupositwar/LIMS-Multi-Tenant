#!/bin/bash
sed -i '/console.error("Docx render error", e);/c \
          console.error("Docx render error", e);\
          if (e.properties && e.properties.errors instanceof Array) {\
            const errorMessages = e.properties.errors.map((err: any) => err.properties.explanation || err.message).join(", ");\
            setDocxError("Erreur dans le modèle Word : " + errorMessages);\
          } else {\
            setDocxError("Erreur lors de la génération de l'\''aperçu du document : " + e.message);\
          }\
' src/components/ReportPreviewModal.tsx
