#!/bin/bash
sed -i '/console.error(e);/c \
          console.error(e);\
          if (e.properties && e.properties.errors instanceof Array) {\
            const errorMessages = e.properties.errors.map((err: any) => err.properties.explanation || err.message).join(", ");\
            alert("Erreur dans le modèle Word : " + errorMessages);\
          } else {\
            alert("Erreur lors de la génération du docx : " + e.message);\
          }\
' src/views/Reports.tsx
