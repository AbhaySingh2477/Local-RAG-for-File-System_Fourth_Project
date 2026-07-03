/**
 * ═══════════════════════════════════════════════════════════════
 * Document Service — Frontend API for document operations.
 * Handles upload, list, get, delete, and real-time progress.
 * ═══════════════════════════════════════════════════════════════
 */

import { api, ws } from '@core/api.js';
import { eventBus, Events } from '@core/events.js';

/**
 * Upload documents to a notebook.
 * @param {string} notebookId
 * @param {File[]} files
 * @returns {Promise<import('@core/api.js').ApiResponse>}
 */
export async function uploadDocuments(notebookId, files) {
  const formData = new FormData();
  formData.append('notebook_id', notebookId);
  files.forEach((file, i) => formData.append('files', file));

  return api.post('/documents', formData, { timeout: 120000 });
}

/**
 * List documents, optionally filtered by notebook.
 * @param {string} [notebookId]
 * @returns {Promise<import('@core/api.js').ApiResponse>}
 */
export async function listDocuments(notebookId) {
  const endpoint = notebookId
    ? `/documents?notebook_id=${encodeURIComponent(notebookId)}`
    : '/documents';
  return api.get(endpoint);
}

/**
 * Get document details.
 * @param {string} documentId
 * @returns {Promise<import('@core/api.js').ApiResponse>}
 */
export async function getDocument(documentId) {
  return api.get(`/documents/${documentId}`);
}

/**
 * Delete a document.
 * @param {string} documentId
 * @returns {Promise<import('@core/api.js').ApiResponse>}
 */
export async function deleteDocument(documentId) {
  return api.delete(`/documents/${documentId}`);
}

/**
 * Reprocess a document.
 * @param {string} documentId
 * @returns {Promise<import('@core/api.js').ApiResponse>}
 */
export async function reprocessDocument(documentId) {
  return api.post(`/documents/${documentId}/reprocess`);
}

/**
 * Listen for document processing progress updates via WebSocket.
 * @param {Function} callback — (data: {document_id, stage, progress, error}) => void
 * @returns {Function} unsubscribe
 */
export function onDocumentProgress(callback) {
  return ws.on('document_progress', callback);
}

/**
 * File type icon mapping.
 * @param {string} fileType
 * @returns {string} icon name
 */
export function getFileIcon(fileType) {
  const iconMap = {
    pdf: 'file-text',
    docx: 'file-text',
    doc: 'file-text',
    txt: 'file',
    md: 'file',
    markdown: 'file',
    csv: 'table',
    tsv: 'table',
    xlsx: 'table',
    xls: 'table',
    json: 'braces',
    jsonl: 'braces',
    html: 'globe',
    htm: 'globe',
    xml: 'code',
    py: 'code',
    js: 'code',
    ts: 'code',
    rs: 'code',
    java: 'code',
    cpp: 'code',
    c: 'code',
    go: 'code',
    rb: 'code',
    php: 'code',
    png: 'image',
    jpg: 'image',
    jpeg: 'image',
    gif: 'image',
    webp: 'image',
  };
  return iconMap[fileType?.toLowerCase()] || 'file';
}

/**
 * Format file size for display.
 * @param {number} bytes
 * @returns {string}
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Get human-readable status label.
 * @param {string} status
 * @returns {{label: string, color: string}}
 */
export function getStatusInfo(status) {
  const map = {
    pending: { label: 'Queued', color: 'var(--color-text-secondary)' },
    processing: { label: 'Processing', color: 'var(--color-warning)' },
    indexed: { label: 'Ready', color: 'var(--color-success)' },
    failed: { label: 'Failed', color: 'var(--color-danger)' },
  };
  return map[status] || { label: status, color: 'var(--color-text-secondary)' };
}
