import { json } from "../_lib/http.js";

export async function onRequestGet({ env }) {
  return json({
    googleClientId: env.GOOGLE_CLIENT_ID || "",
    drive: {
      pdfsFolderId: env.DRIVE_PDFS_FOLDER_ID || "1crGud0x3BzBdfjQmuLzoZCpWQLNKdvRH",
      coversFolderId: env.DRIVE_CAPAS_FOLDER_ID || "15i-u7YP80ufKZyyxMG6Nfeaa_StXPFZd",
      backupCatalogFolderId: env.DRIVE_BACKUP_CATALOGO_FOLDER_ID || "1Abfo-U7hPHEuwazaAJ4RTJMKr1yxRxhJ",
      backupSheetsFolderId: env.DRIVE_BACKUP_PLANILHAS_FOLDER_ID || "1gaVbnfzzWOmdFPRmUE6UvBkHkJNg0fcA"
    },
    legacyCatalogUrl: env.LEGACY_CATALOG_URL || "https://sembarreira.netlify.app/api/livros"
  });
}
