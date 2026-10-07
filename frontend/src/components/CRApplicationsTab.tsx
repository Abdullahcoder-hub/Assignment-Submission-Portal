import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import { CRApplication, Class, StudentUser } from '../types';
import {
  Crown,
  RefreshCw,
  Loader2,
  CheckCircle,
  AlertCircle,
  Check,
  X,
  Search,
} from 'lucide-react';

type PopulatedApplication = Omit<CRApplication, 'studentId' | 'classId'> & {
  studentId: Pick<StudentUser, 'id' | 'name' | 'email' | 'rollNumber'> | string;
  classId: Pick<Class, '_id' | 'name' | 'section' | 'semester'> | string;
  legacyStaffRequest?: boolean;
};

export const CRApplicationsTab: React.FC = () => {
  const [applications, setApplications] = useState<PopulatedApplication[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [feedback, setFeedback] = useState<{ success: boolean; message: string } | null>(null);
  const [deciding, setDeciding] = useState<string | null>(null);

  const fetchApplications = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/cr-applications/admin/all');
      if (res.data.success) {
        setApplications(res.data.applications || []);
      }
      const classResponse = await api.get('/classes');
      if (classResponse.data.success) setClasses(classResponse.data.classes || []);
    } catch (err: any) {
      setFeedback({ success: false, message: err.response?.data?.message || 'Failed to load CR applications.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  const handleDecision = async (id: string, decision: 'APPROVED' | 'REJECTED', rejectionReason?: string) => {
    try {
      setDeciding(id);
      const res = await api.patch(`/cr-applications/admin/${id}/decision`, {
        decision,
        rejectionReason,
        classId: selectedClasses[id] || undefined,
      });
      if (res.data.success) {
        setFeedback({ success: true, message: res.data.message });
        await fetchApplications();
      }
    } catch (err: any) {
      setFeedback({ success: false, message: err.response?.data?.message || 'Failed to process decision.' });
    } finally {
      setDeciding(null);
    }
  };

  const handleReject = async (id: string) => {
    const reason = window.prompt('Rejection reason (optional):') ?? undefined;
    if (reason === null) return; // user cancelled
    await handleDecision(id, 'REJECTED', reason || undefined);
  };

  const getStatusBadge = (status: string) => {
    if (status === 'APPROVED')
      return <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold text-xs">Approved</span>;
    if (status === 'REJECTED')
      return <span className="px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 font-semibold text-xs">Rejected</span>;
    return <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-semibold text-xs">Pending</span>;
  };

  const getRoleBadge = (roleType: string) => {
    if (roleType === 'CR_ASSISTANT')
      return <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold text-xs">CR Assistant</span>;
    return <span className="px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 font-semibold text-xs flex items-center gap-1"><Crown className="w-3 h-3" />Class CR</span>;
  };

  const filtered = applications.filter((app) => {
    const student = app.studentId as any;
    const cls = app.classId as any;
    const matchesSearch =
      !search ||
      student?.name?.toLowerCase().includes(search.toLowerCase()) ||
      student?.email?.toLowerCase().includes(search.toLowerCase()) ||
      student?.rollNumber?.toLowerCase().includes(search.toLowerCase()) ||
      cls?.name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || app.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Crown className="w-5 h-5 text-purple-600" />
            CR / CR Assistant Applications
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Review student applications for Class Representative and CR Assistant positions.
          </p>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl text-sm flex items-center justify-between ${
            feedback.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.success ? <CheckCircle className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-red-600" />}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600 text-xs font-semibold">
            Dismiss
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search by name, email, roll, class..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <div className="flex items-center gap-2 self-end">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
          <button
            onClick={fetchApplications}
            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600 mx-auto" />
          <p className="text-sm text-slate-500 mt-2">Loading applications...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 p-8">
          <Crown className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-semibold text-slate-800 mt-3">No Applications Found</h3>
          <p className="text-sm text-slate-500 mt-1">Student CR / CR Assistant applications will appear here.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-4 py-3.5">Student</th>
                  <th className="px-4 py-3.5">Class</th>
                  <th className="px-4 py-3.5">Applying For</th>
                  <th className="px-4 py-3.5">Reason</th>
                  <th className="px-4 py-3.5">Applied</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((app) => {
                  const student = app.studentId as any;
                  const cls = app.classId as any;
                  const isProcessing = deciding === app._id;
                  return (
                    <tr key={app._id} className="hover:bg-slate-50/80 transition">
                      <td className="px-4 py-3.5">
                        <p className="font-semibold text-slate-900">{student?.name || '—'}</p>
                        <p className="text-xs text-slate-500">{student?.email || ''}</p>
                        <p className="text-xs font-mono text-slate-400">{student?.rollNumber || ''}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        {cls ? (
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                            {cls.name} (Sec: {cls.section})
                          </span>
                        ) : (
                          app.legacyStaffRequest ? (
                            <select
                              aria-label={`Select class for ${student?.name || 'CR request'}`}
                              value={selectedClasses[app._id] || ''}
                              onChange={(event) =>
                                setSelectedClasses((current) => ({ ...current, [app._id]: event.target.value }))
                              }
                              className="max-w-56 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs"
                            >
                              <option value="">Select class</option>
                              {classes.filter((classItem) => classItem.isActive).map((classItem) => (
                                <option key={classItem._id} value={classItem._id}>
                                  {classItem.name} (Sec: {classItem.section})
                                </option>
                              ))}
                            </select>
                          ) : <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">{getRoleBadge(app.roleType)}</td>
                      <td className="px-4 py-3.5 max-w-[160px]">
                        <p className="text-xs text-slate-500 truncate" title={app.reason}>
                          {app.reason || <span className="italic text-slate-300">No reason given</span>}
                        </p>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-slate-500 whitespace-nowrap">
                        {new Date(app.appliedAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3.5">{getStatusBadge(app.status)}</td>
                      <td className="px-4 py-3.5 text-right space-x-1">
                        {app.status === 'PENDING' && (
                          <>
                            <button
                              onClick={() => handleDecision(app._id, 'APPROVED')}
                              disabled={isProcessing || (app.legacyStaffRequest === true && !cls && !selectedClasses[app._id])}
                              className="inline-flex items-center gap-1 px-2 py-1 text-emerald-700 hover:bg-emerald-50 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition"
                              title={app.legacyStaffRequest && !cls ? 'Select a class before approval' : 'Approve application'}
                            >
                              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                              <span className="text-xs font-semibold">Approve</span>
                            </button>
                            <button
                              onClick={() => handleReject(app._id)}
                              disabled={isProcessing}
                              className="inline-flex items-center gap-1 px-2 py-1 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition"
                              title="Reject application"
                            >
                              <X className="w-4 h-4" />
                              <span className="text-xs font-semibold">Reject</span>
                            </button>
                          </>
                        )}
                        {app.status !== 'PENDING' && (
                          <span className="text-xs text-slate-400 italic">Decided</span>
                        )}
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
  );
};
