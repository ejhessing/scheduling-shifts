import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentsApi } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import {
  FileText,
  Upload,
  Download,
  Trash2,
  CheckCircle,
  XCircle,
  Search,
  Filter,
  AlertTriangle,
  File,
} from 'lucide-react';
import { PageHeader, LoadingSpinner, StatusBadge, Modal, EmptyState, Button } from '../components/ui';
import { formatDate, formatFileSize } from '../lib/utils';

interface Document {
  documentId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  category: string;
  description?: string;
  expirationDate?: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  uploadedBy: string;
  uploadedAt: string;
  userId?: string;
}

const categories = [
  { value: 'tax_form', label: 'Tax Form' },
  { value: 'identification', label: 'Identification' },
  { value: 'certification', label: 'Certification/License' },
  { value: 'employment', label: 'Employment Document' },
  { value: 'benefits', label: 'Benefits Enrollment' },
  { value: 'training', label: 'Training Certificate' },
  { value: 'performance', label: 'Performance Review' },
  { value: 'policy', label: 'Policy Document' },
  { value: 'timesheet', label: 'Timesheet Document' },
  { value: 'other', label: 'Other' },
];

export default function DocumentsPage() {
  const user = useAuthStore((state) => state.user);
  const isManager = user?.role === 'manager' || user?.role === 'admin' || user?.role === 'owner';
  const queryClient = useQueryClient();

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Upload form state
  const [uploadForm, setUploadForm] = useState({
    category: 'other',
    description: '',
    expirationDate: '',
  });

  // Fetch documents
  const { data: documents, isLoading } = useQuery({
    queryKey: ['documents', filterCategory, filterStatus, searchQuery],
    queryFn: async () => {
      const params: any = {};
      if (filterCategory) params.category = filterCategory;
      if (filterStatus) params.status = filterStatus;
      if (searchQuery) params.search = searchQuery;

      const response = await documentsApi.getDocuments(params);
      return response.data.data as Document[];
    },
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error('No file selected');

      // First, get presigned URL
      const metadata = {
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        fileType: selectedFile.type,
        category: uploadForm.category,
        description: uploadForm.description || undefined,
        expirationDate: uploadForm.expirationDate || undefined,
      };

      const response = await documentsApi.uploadDocument(metadata);
      const { uploadUrl } = response.data.data;

      // Upload file to S3
      await fetch(uploadUrl, {
        method: 'PUT',
        body: selectedFile,
        headers: {
          'Content-Type': selectedFile.type,
        },
      });

      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      setShowUploadModal(false);
      setSelectedFile(null);
      setUploadForm({ category: 'other', description: '', expirationDate: '' });
    },
    onError: (error: any) => {
      alert(`Upload failed: ${error.message}`);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: documentsApi.deleteDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: ({ documentId, action }: { documentId: string; action: 'approve' | 'reject' }) =>
      documentsApi.approveDocument(documentId, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });

  // Download document
  const handleDownload = async (documentId: string, fileName: string) => {
    try {
      const response = await documentsApi.getDocument(documentId);
      const { downloadUrl } = response.data.data;

      // Open in new tab for download
      window.open(downloadUrl, '_blank');
    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to download document');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = () => {
    if (selectedFile) {
      uploadMutation.mutate();
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        title="Documents"
        description="Manage employee documents, certifications, and files"
        icon={FileText}
        action={
          <Button onClick={() => setShowUploadModal(true)} icon={Upload}>
            Upload Document
          </Button>
        }
      />

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search documents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-400" />
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="expired">Expired</option>
              </select>
            </div>
          </div>
        </div>

        {/* Documents List */}
        {!documents || documents.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No Documents"
            description="Upload your first document to get started"
            action={
              <Button onClick={() => setShowUploadModal(true)} icon={Upload}>
                Upload Document
              </Button>
            }
          />
        ) : (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Document</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Size</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Uploaded</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expiration</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {documents.map((doc) => {
                    const isExpiringSoon =
                      doc.expirationDate &&
                      new Date(doc.expirationDate) > new Date() &&
                      new Date(doc.expirationDate).getTime() - new Date().getTime() <
                        30 * 24 * 60 * 60 * 1000;

                    return (
                      <tr key={doc.documentId} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <File className="w-5 h-5 text-gray-400" />
                            <div>
                              <div className="text-sm font-medium text-gray-900">{doc.fileName}</div>
                              {doc.description && (
                                <div className="text-sm text-gray-500">{doc.description}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {categories.find((c) => c.value === doc.category)?.label || doc.category}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {formatFileSize(doc.fileSize)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {formatDate(new Date(doc.uploadedAt))}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {doc.expirationDate ? (
                            <span className={isExpiringSoon ? 'text-orange-600 font-medium' : 'text-gray-600'}>
                              {isExpiringSoon && <AlertTriangle className="w-4 h-4 inline mr-1" />}
                              {formatDate(new Date(doc.expirationDate))}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <StatusBadge status={doc.status} />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleDownload(doc.documentId, doc.fileName)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                              title="Download"
                            >
                              <Download className="w-4 h-4" />
                            </button>

                            {isManager && doc.status === 'pending' && (
                              <>
                                <button
                                  onClick={() =>
                                    approveMutation.mutate({ documentId: doc.documentId, action: 'approve' })
                                  }
                                  className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                                  title="Approve"
                                  disabled={approveMutation.isPending}
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() =>
                                    approveMutation.mutate({ documentId: doc.documentId, action: 'reject' })
                                  }
                                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                                  title="Reject"
                                  disabled={approveMutation.isPending}
                                >
                                  <XCircle className="w-4 h-4" />
                                </button>
                              </>
                            )}

                            {(doc.uploadedBy === user?.userId || isManager) && (
                              <button
                                onClick={() => {
                                  if (confirm('Are you sure you want to delete this document?')) {
                                    deleteMutation.mutate(doc.documentId);
                                  }
                                }}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                                title="Delete"
                                disabled={deleteMutation.isPending}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      <Modal
        isOpen={showUploadModal}
        onClose={() => {
          setShowUploadModal(false);
          setSelectedFile(null);
        }}
        title="Upload Document"
        icon={Upload}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">File</label>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.jpg,.jpeg,.png,.gif"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
            {selectedFile && (
              <p className="mt-2 text-sm text-gray-600">
                Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})
              </p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Allowed: PDF, Word, Excel, Images (Max 10MB)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={uploadForm.category}
              onChange={(e) => setUploadForm({ ...uploadForm, category: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              {categories.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (optional)
            </label>
            <textarea
              value={uploadForm.description}
              onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="Add a brief description..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Expiration Date (optional)
            </label>
            <input
              type="date"
              value={uploadForm.expirationDate}
              onChange={(e) => setUploadForm({ ...uploadForm, expirationDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
            <p className="mt-1 text-xs text-gray-500">
              For certifications and licenses that expire
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={() => {
                setShowUploadModal(false);
                setSelectedFile(null);
              }}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={!selectedFile || uploadMutation.isPending}
              className="flex-1 px-4 py-2 text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploadMutation.isPending ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
