import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

type Role = "student" | "faculty" | "admin";

function Status({ value }: { value: string }) {
  return <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", value === "present" ? "bg-emerald-50 text-emerald-700" : value === "late" ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700")}>{value}</span>;
}

export default function AttendanceManagement({ role, overview }: { role: Role; overview: any }) {
  const isStudent = role === "student";
  const [subjectId, setSubjectId] = useState<number | undefined>();
  const [sessionId, setSessionId] = useState<number | undefined>();
  const [search, setSearch] = useState("");
  const [month, setMonth] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const subjects = overview.facultySubjects ?? overview.subjects;
  const attendance = trpc.attendance.list.useQuery(subjectId ? { subjectId } : undefined);
  const roster = trpc.attendance.roster.useQuery({ sessionId: sessionId ?? 0 }, { enabled: !isStudent && Boolean(sessionId) });
  const utils = trpc.useUtils();
  const [marks, setMarks] = useState<Record<number, "present" | "absent" | "late">>({});
  const [form, setForm] = useState({ subjectId: subjects[0]?.id ?? 0, sessionDate: new Date().toISOString().slice(0, 10), sessionTime: "09:00" });

  useEffect(() => {
    if (roster.data) setMarks(Object.fromEntries(roster.data.map(row => [row.studentId, row.status ?? "absent"])));
  }, [roster.data]);

  const createSession = trpc.attendance.createSession.useMutation({
    onSuccess: result => { toast.success(result.existing ? "Existing attendance session opened" : "Attendance session created"); utils.attendance.list.invalidate(); setSessionId(result.id); },
    onError: error => toast.error(error.message),
  });
  const saveRecords = trpc.attendance.saveRecords.useMutation({
    onSuccess: () => { toast.success("Attendance saved"); utils.attendance.list.invalidate(); roster.refetch(); utils.dashboard.overview.invalidate(); },
    onError: error => toast.error(error.message),
  });

  const filteredHistory = useMemo(() => (attendance.data ?? []).filter(row => {
    const date = new Date(row.sessionDate);
    return (!month || `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}` === month) &&
      (!statusFilter || row.record?.status === statusFilter);
  }), [attendance.data, month, statusFilter]);
  const filteredRoster = (roster.data ?? []).filter(row => `${row.name} ${row.rollNumber}`.toLowerCase().includes(search.toLowerCase()));

  if (isStudent) {
    return <div className="space-y-6">
      <div><p className="text-sm font-medium text-indigo-600">Attendance</p><h2 className="mt-1 text-2xl font-semibold text-slate-900">Your attendance history</h2><p className="mt-1 text-sm text-slate-500">Only your enrolled subjects and recorded sessions are shown.</p></div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{(overview.subjects ?? []).map((subject: any) => <Card key={subject.id}><CardHeader className="pb-3"><CardTitle className="text-base">{subject.name}</CardTitle><CardDescription>{subject.code}</CardDescription></CardHeader><CardContent><div className="flex items-end justify-between"><div><p className="text-2xl font-semibold">{subject.percentage}%</p><p className="text-xs text-slate-500">{subject.attended} attended · {subject.missed ?? Math.max(0, subject.conducted - subject.attended)} missed</p></div><p className="text-xs text-slate-500">{subject.conducted} classes</p></div></CardContent></Card>)}</div>
      <Card><CardHeader><CardTitle>Detailed history</CardTitle><CardDescription>Filter by month or attendance status.</CardDescription></CardHeader><CardContent><div className="mb-4 flex flex-wrap gap-2"><select className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm" value={subjectId ?? ""} onChange={event => setSubjectId(event.target.value ? Number(event.target.value) : undefined)}><option value="">All subjects</option>{(overview.subjects ?? []).map((subject: any) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select><Input className="w-auto" type="month" value={month} onChange={event => setMonth(event.target.value)} /><select className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option value="">All statuses</option><option value="present">Present</option><option value="absent">Absent</option><option value="late">Late</option></select></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-y border-slate-100 bg-slate-50 text-xs uppercase text-slate-400"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Subject</th><th className="px-4 py-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredHistory.map(row => <tr key={row.id}><td className="px-4 py-3">{new Date(row.sessionDate).toLocaleDateString("en-IN")}</td><td className="px-4 py-3">{row.subject}</td><td className="px-4 py-3">{row.record ? <Status value={row.record.status} /> : <span className="text-xs text-slate-400">Not recorded</span>}</td></tr>)}</tbody></table>{!filteredHistory.length && <p className="py-8 text-center text-sm text-slate-400">No attendance records match these filters.</p>}</div></CardContent></Card>
    </div>;
  }

  return <div className="space-y-6">
    <div><p className="text-sm font-medium text-indigo-600">Attendance management</p><h2 className="mt-1 text-2xl font-semibold text-slate-900">Take attendance</h2><p className="mt-1 text-sm text-slate-500">Create or reopen a session, then save the complete class roster.</p></div>
    <Card><CardHeader><CardTitle className="text-base">Open attendance session</CardTitle><CardDescription>Sessions are unique by subject, date, and section.</CardDescription></CardHeader><CardContent><form className="grid gap-3 md:grid-cols-[1.5fr_1fr_1fr_auto]" onSubmit={event => { event.preventDefault(); createSession.mutate(form); }}><select className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm" value={form.subjectId} onChange={event => setForm({ ...form, subjectId: Number(event.target.value) })}>{subjects.map((subject: any) => <option key={subject.id} value={subject.id}>{subject.name} ({subject.code})</option>)}</select><Input type="date" value={form.sessionDate} onChange={event => setForm({ ...form, sessionDate: event.target.value })} /><Input type="time" value={form.sessionTime} onChange={event => setForm({ ...form, sessionTime: event.target.value })} /><Button disabled={createSession.isPending || !form.subjectId} className="bg-indigo-600 text-white hover:bg-indigo-700">Open session</Button></form></CardContent></Card>
    <Card><CardHeader><CardTitle className="text-base">Assigned subject sessions</CardTitle></CardHeader><CardContent><div className="mb-4 flex flex-wrap gap-2"><select className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm" value={subjectId ?? ""} onChange={event => setSubjectId(event.target.value ? Number(event.target.value) : undefined)}><option value="">All assigned subjects</option>{subjects.map((subject: any) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></div><div className="space-y-2">{(attendance.data ?? []).map(row => <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-100 p-3"><div><p className="font-medium text-slate-800">{row.subject}</p><p className="text-xs text-slate-500">{new Date(row.sessionDate).toLocaleDateString("en-IN")} · {String(row.sessionTime).slice(0, 5)}</p></div><Button variant="outline" size="sm" onClick={() => setSessionId(row.id)}>Edit roster</Button></div>)}{!attendance.data?.length && <p className="py-6 text-center text-sm text-slate-400">No sessions found.</p>}</div></CardContent></Card>
    {sessionId && <Card className="border-indigo-100"><CardHeader className="flex-row items-start justify-between"><div><CardTitle className="text-base">Class roster</CardTitle><CardDescription>Unchecked students are not automatically saved as absent; save explicitly.</CardDescription></div><Button variant="ghost" size="sm" onClick={() => setSessionId(undefined)}><X className="h-4 w-4" /></Button></CardHeader><CardContent><div className="mb-4 flex flex-wrap gap-2"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input className="pl-9" placeholder="Search name or roll number" value={search} onChange={event => setSearch(event.target.value)} /></div><Button variant="outline" onClick={() => setMarks(Object.fromEntries((roster.data ?? []).map(row => [row.studentId, "present"])))}>Mark all present</Button><Button variant="outline" onClick={() => setMarks(Object.fromEntries((roster.data ?? []).map(row => [row.studentId, "absent"])))}>Mark all absent</Button></div><div className="space-y-2">{filteredRoster.map(row => <label key={row.studentId} className="flex items-center justify-between rounded-lg border border-slate-100 p-3"><span><span className="block text-sm font-medium">{row.name}</span><span className="text-xs text-slate-500">{row.rollNumber}</span></span><span className="flex items-center gap-2 text-sm"><Checkbox checked={marks[row.studentId] === "present"} onCheckedChange={checked => setMarks({ ...marks, [row.studentId]: checked ? "present" : "absent" })} /> Present</span></label>)}</div><Button className="mt-4 bg-indigo-600 text-white hover:bg-indigo-700" disabled={saveRecords.isPending || !roster.data?.length} onClick={() => saveRecords.mutate({ sessionId, records: (roster.data ?? []).map(row => ({ studentId: row.studentId, status: marks[row.studentId] ?? "absent" })) })}><Check className="h-4 w-4" /> {saveRecords.isPending ? "Saving…" : "Save attendance"}</Button></CardContent></Card>}
  </div>;
}
