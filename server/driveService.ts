/**
 * Google Drive API Integration Service
 * Academia Giantucchi
 *
 * Provides connection to Google Drive API v3 to list, search, and fetch
 * video metadata for streaming in the platform. Includes fallback curated drive assets
 * when credentials are not yet set up in production.
 */

import { google } from 'googleapis';

export interface DriveVideoFile {
  id: string;
  name: string;
  mimeType: string;
  thumbnailLink?: string;
  webContentLink?: string;
  webViewLink?: string;
  embedUrl: string;
  duration?: string;
  size?: string;
  createdTime?: string;
}

// Default curated Google Drive high quality educational videos for Academia Giantucchi demo
const CURATED_DRIVE_VIDEOS: DriveVideoFile[] = [
  {
    id: '1a_Giantucchi_Intro_Fundamentos',
    name: '01. Fundamentos de la Metodología Giantucchi & Mentalidad de Alto Impacto',
    mimeType: 'video/mp4',
    thumbnailLink: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop&q=80',
    embedUrl: 'https://drive.google.com/file/d/15_m3K8e_Giantucchi_Fundamentos/preview',
    duration: '18:45',
    size: '142 MB',
    createdTime: new Date().toISOString(),
  },
  {
    id: '1b_Giantucchi_Arquitectura',
    name: '02. Arquitectura de Sistemas Distribuidos y Escala Empresarial',
    mimeType: 'video/mp4',
    thumbnailLink: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&auto=format&fit=crop&q=80',
    embedUrl: 'https://drive.google.com/file/d/16_m3K8e_Giantucchi_Arquitectura/preview',
    duration: '32:10',
    size: '280 MB',
    createdTime: new Date().toISOString(),
  },
  {
    id: '1c_Giantucchi_Postgres_Prisma',
    name: '03. Modelado Avanzado en PostgreSQL con Prisma ORM & Índices',
    mimeType: 'video/mp4',
    thumbnailLink: 'https://images.unsplash.com/photo-1544383835-bda2bc66a55d?w=800&auto=format&fit=crop&q=80',
    embedUrl: 'https://drive.google.com/file/d/17_m3K8e_Giantucchi_Postgres/preview',
    duration: '26:50',
    size: '210 MB',
    createdTime: new Date().toISOString(),
  },
  {
    id: '2a_Giantucchi_Seguridad_RBAC',
    name: '04. Seguridad Robusta: Autenticación JWT, RBAC y Bypass VIP',
    mimeType: 'video/mp4',
    thumbnailLink: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=800&auto=format&fit=crop&q=80',
    embedUrl: 'https://drive.google.com/file/d/18_m3K8e_Giantucchi_Seguridad/preview',
    duration: '22:15',
    size: '185 MB',
    createdTime: new Date().toISOString(),
  },
  {
    id: '2b_Giantucchi_Despliegue_Cloud',
    name: '05. Despliegue en la Nube y Optimización de Rendimiento en Producción',
    mimeType: 'video/mp4',
    thumbnailLink: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&auto=format&fit=crop&q=80',
    embedUrl: 'https://drive.google.com/file/d/19_m3K8e_Giantucchi_Despliegue/preview',
    duration: '40:00',
    size: '350 MB',
    createdTime: new Date().toISOString(),
  },
];

/**
 * Initializes Google Drive API client using process.env credentials or returns null
 */
function getDriveClient() {
  const apiKey = process.env.GOOGLE_DRIVE_API_KEY;
  const clientEmail = process.env.GOOGLE_DRIVE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_DRIVE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (clientEmail && privateKey) {
    const auth = new google.auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });
    return google.drive({ version: 'v3', auth });
  }

  if (apiKey) {
    return google.drive({ version: 'v3', auth: apiKey });
  }

  return null;
}

/**
 * Searches Google Drive folder for video files
 */
export async function searchDriveVideos(query?: string, folderId?: string): Promise<DriveVideoFile[]> {
  const drive = getDriveClient();
  const targetFolder = folderId || process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (drive) {
    try {
      let q = "mimeType contains 'video/' and trashed = false";
      if (targetFolder) {
        q += ` and '${targetFolder}' in parents`;
      }
      if (query && query.trim()) {
        q += ` and name contains '${query.trim().replace(/'/g, "\\'")}'`;
      }

      const response = await drive.files.list({
        q,
        fields: 'files(id, name, mimeType, thumbnailLink, webContentLink, webViewLink, size, createdTime)',
        pageSize: 20,
        orderBy: 'name',
      });

      if (response.data.files && response.data.files.length > 0) {
        return response.data.files.map((file) => ({
          id: file.id || '',
          name: file.name || 'Video de Google Drive',
          mimeType: file.mimeType || 'video/mp4',
          thumbnailLink: file.thumbnailLink,
          webContentLink: file.webContentLink,
          webViewLink: file.webViewLink,
          embedUrl: `https://drive.google.com/file/d/${file.id}/preview`,
          size: file.size ? `${(parseInt(file.size) / (1024 * 1024)).toFixed(1)} MB` : undefined,
          createdTime: file.createdTime || new Date().toISOString(),
        }));
      }
    } catch (error) {
      console.warn('⚠️ Error fetching Google Drive API, falling back to curated Drive videos:', error);
    }
  }

  // Fallback to curated drive videos if API key is not configured or query fails
  if (!query || !query.trim()) {
    return CURATED_DRIVE_VIDEOS;
  }

  const lowercaseQuery = query.toLowerCase();
  return CURATED_DRIVE_VIDEOS.filter(
    (video) => video.name.toLowerCase().includes(lowercaseQuery) || video.id.toLowerCase().includes(lowercaseQuery)
  );
}

/**
 * Gets details for a single Drive file ID
 */
export async function getDriveFileInfo(fileId: string): Promise<DriveVideoFile> {
  const drive = getDriveClient();

  if (drive) {
    try {
      const response = await drive.files.get({
        fileId,
        fields: 'id, name, mimeType, thumbnailLink, webContentLink, webViewLink, size, createdTime',
      });

      const file = response.data;
      return {
        id: file.id || fileId,
        name: file.name || 'Video de Mentoría',
        mimeType: file.mimeType || 'video/mp4',
        thumbnailLink: file.thumbnailLink,
        webContentLink: file.webContentLink,
        webViewLink: file.webViewLink,
        embedUrl: `https://drive.google.com/file/d/${file.id}/preview`,
        size: file.size ? `${(parseInt(file.size) / (1024 * 1024)).toFixed(1)} MB` : undefined,
        createdTime: file.createdTime || new Date().toISOString(),
      };
    } catch (error) {
      console.warn('⚠️ Error fetching Drive file info:', error);
    }
  }

  const existing = CURATED_DRIVE_VIDEOS.find((v) => v.id === fileId);
  if (existing) return existing;

  return {
    id: fileId,
    name: 'Video de Mentoría en Google Drive',
    mimeType: 'video/mp4',
    embedUrl: `https://drive.google.com/file/d/${fileId}/preview`,
    duration: '25:00',
    size: '200 MB',
  };
}
