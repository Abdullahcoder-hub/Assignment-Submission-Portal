import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { SharedAssignment } from '../types';
import {
  Archive,
  FileSpreadsheet,
  Download,
  Search,
  RefreshCw,
  Loader2,
  Calendar,
  Clock,
  User,
  BookOpen,
  GraduationCap,
  MessageSquare,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

export const TeacherSharedAssignmentsSection: React.FC = () => {
  const [sharedList, setSharedList] = useState<SharedAssignment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [search, setSearch] = useState<string>('');
  const [downloadingZipId, setDownloadingZipId] = useState<string | null>(null);
  const [downloadingCsvId, setDownloadingCsvId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchSharedAssignments = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await api.get('/api/shared-assignments/teacher-received');
      if (res.data?.success) {
        setSharedList(res.data.sharedAssignments || []);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load shared assignments.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSharedAssignments();
  }, []);

  const handleDownloadZip = async (item: SharedAssignment) => {
    setDownloadingZipId(item._id);
    try {
      const response = await api.get(`/api/shared-assignments/${item._id}/download-zip`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const subCode = item.subjectId?.code || 'SUB';
      const cleanTitle = (item.assignmentId?.title || 'Assignment').replace(/[^a-zA-Z0-9_-]/g, '_');
      link.setAttribute('download', `${subCode}_${cleanTitle}_Submissions.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      fetchSharedAssignments(true);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to download ZIP file.');
    } finally {
      setDownloadingZipId(null);
    }
  };

  const handleDownloadCsv = async (item: SharedAssignment) => {
    setDownloadingCsvId(item._id);
    try {
      const response = await api.get(`/api/shared-assignments/${item._id}/download-csv`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const subCode = item.subjectId?.code || 'SUB';
      const cleanTitle = (item.assignmentId?.title || 'Assignment').replace(/[^a-zA-Z0-9_-]/g, '_');
      link.setAttribute('download', `${subCode}_${cleanTitle}_Report.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      fetchSharedAssignments(true);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to download CSV report.');
    } finally {
      setDownloadingCsvId(null);
    }
  };

  const filteredList = sharedList.filter((item) => {
    const term = search.toLowerCase();
    const title = item.assignmentId?.title?.toLowerCase() || '';
    const subject = item.subjectId?.name?.toLowerCase() || '';
    const code = item.subjectId?.code?.toLowerCase() || '';
    const className = item.classId?.name?.toLowerCase() || '';
    const crName = item.crId?.name?.toLowerCase() || '';
    return title.includes(term) || subject.includes(term) || code.includes(term) || className.includes(term) || crName.includes(term);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
              <Archive className="w-6 h-6" />
            </div>
            Shared Assignment Submissions
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Download assignment submissions packages and defaulter reports shared with you by Class Representatives.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search packages..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
          <button
            onClick={() => fetchSharedAssignments(true)}
            disabled={refreshing || loading}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-600 dark:text-slate-300 transition-colors disabled:opacity-50"
            title="Refresh shared packages"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-blue-500' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Main Content */}
      {loading ? (
        <div className="py-20 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-3" />
          <p className="text-slate-500 dark:text-slate-400 text-sm">Loading shared assignment packages...</p>
        </div>
      ) : filteredList.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-12 text-center border border-slate-200 dark:border-slate-700">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center mx-auto mb-4 text-slate-400">
            <Archive className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">No Shared Assignments Found</h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm max-w-md mx-auto">
            {search
              ? 'No packages match your search filter.'
              : 'When a Class Representative shares student assignment submission packages (ZIP/CSV) with you, they will appear here.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredList.map((item) => {
            const assignment = item.assignmentId;
            const subject = item.subjectId;
            const targetClass = item.classId;
            const cr = item.crId;

            return (
              <div
                key={item._id}
                className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm hover:border-blue-500/50 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                        {subject?.code || 'SUBJECT'}
                      </span>
                      {targetClass && (
                        <span className="px-2.5 py-1 text-xs font-medium rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                          <GraduationCap className="w-3 h-3" />
                          {targetClass.name} ({targetClass.section || 'General'})
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(item.sharedAt).toLocaleDateString()}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
                    {assignment?.title || 'Assignment Package'}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 text-slate-400" />
                    {subject?.name || 'Subject'}
                  </p>

                  <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3.5 space-y-2 text-xs text-slate-600 dark:text-slate-300 mb-4 border border-slate-100 dark:border-slate-800">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400 flex items-center gap-1">
                        <User className="w-3.5 h-3.5" /> Shared By CR:
                      </span>
                      <span className="font-semibold text-slate-700 dark:text-slate-200">{cr?.name || 'Class Representative'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Total Submissions:</span>
                      <span className="font-bold text-blue-600 dark:text-blue-400">{item.submissionsCount ?? 0} Student(s)</span>
                    </div>
                    {item.downloadCount > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400">Downloaded:</span>
                        <span className="font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> {item.downloadCount} time(s)
                        </span>
                      </div>
                    )}
                    {item.note && (
                      <div className="pt-2 border-t border-slate-200 dark:border-slate-800 mt-2">
                        <p className="text-slate-500 dark:text-slate-400 italic flex items-start gap-1">
                          <MessageSquare className="w-3.5 h-3.5 shrink-0 mt-0.5" /> "{item.note}"
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-750">
                  {item.shareZip && (
                    <button
                      onClick={() => handleDownloadZip(item)}
                      disabled={downloadingZipId === item._id}
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium text-xs shadow-sm transition-all disabled:opacity-50"
                    >
                      {downloadingZipId === item._id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Archive className="w-4 h-4" />
                      )}
                      <span>Download ZIP</span>
                    </button>
                  )}

                  {item.shareCsv && (
                    <button
                      onClick={() => handleDownloadCsv(item)}
                      disabled={downloadingCsvId === item._id}
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-medium text-xs shadow-sm transition-all disabled:opacity-50"
                    >
                      {downloadingCsvId === item._id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <FileSpreadsheet className="w-4 h-4" />
                      )}
                      <span>Download CSV</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
