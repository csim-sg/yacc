/**
 * Attachment Preview Component
 * Displays inline thumbnails for images, files, and documents
 */

import React, { useState } from 'react';

interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  uploadedAt?: string;
}

interface AttachmentPreviewProps {
  attachment: Attachment;
  onDownload?: (url: string) => void;
  showMetadata?: boolean;
}

/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Get file icon based on MIME type
 */
function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) {
    return (
      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
        <path
          fillRule="evenodd"
          d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
          clipRule="evenodd"
        />
      </svg>
    );
  }
  if (mimeType.includes('pdf')) {
    return (
      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
        <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
        <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0015.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z" />
      </svg>
    );
  }

  // Generic file icon
  return (
    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M4 4a2 2 0 012-2h6a1 1 0 00-.707.293l-7 7A1 1 0 004 13v-9z" />
      <path d="M12 2h2a2 2 0 012 2v6h-4V2z" />
      <path d="M14 15H4v3a2 2 0 002 2h8a2 2 0 002-2v-3z" />
    </svg>
  );
}

/**
 * AttachmentPreview Component
 * Shows file preview inline in timeline
 */
export const AttachmentPreview: React.FC<AttachmentPreviewProps> = ({
  attachment,
  onDownload,
  showMetadata = true,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const isImage = attachment.type.startsWith('image/');

  return (
    <div className="mt-2 rounded-lg border border-base-300 overflow-hidden">
      {isImage ? (
        // Image preview
        <div className="relative bg-base-100">
          <img
            src={attachment.url}
            alt={attachment.name}
            className="max-w-xs max-h-64 rounded-lg"
            onLoad={() => setIsLoading(false)}
            onError={() => setIsLoading(false)}
          />
          {isLoading && (
            <div className="absolute inset-0 bg-base-200/50 flex items-center justify-center">
              <span className="loading loading-spinner loading-sm" />
            </div>
          )}
        </div>
      ) : (
        // File preview
        <div className="p-3 flex items-center gap-3 bg-base-100 hover:bg-base-200 transition-colors">
          <div className="text-base-content/60 flex-shrink-0">{getFileIcon(attachment.type)}</div>

          <div className="flex-1 min-w-0">
            <a
              href={attachment.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-primary hover:underline truncate"
              title={attachment.name}
            >
              {attachment.name}
            </a>
            <div className="text-xs text-base-content/60">
              {formatFileSize(attachment.size)}
            </div>
          </div>

          {onDownload && (
            <button
              className="flex-shrink-0 p-2 hover:bg-base-300 rounded transition-colors"
              onClick={() => onDownload(attachment.url)}
              title="Download"
              type="button"
              aria-label={`Download ${attachment.name}`}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* Metadata */}
      {showMetadata && (
        <div className="px-3 py-2 bg-base-100 border-t border-base-300 text-xs text-base-content/60">
          <div>Type: {attachment.type}</div>
          {attachment.uploadedAt && (
            <div>
              Uploaded:{' '}
              {new Date(attachment.uploadedAt).toLocaleString([], {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

AttachmentPreview.displayName = 'AttachmentPreview';
