import React, { useState, useEffect } from 'react';
import { UserRole, Exam, Team } from './types';
import { getTeams, registerStudentSession, importData } from './services/storageService';
import { p2pService } from './services/p2pService';
import TeacherDashboard from './components/TeacherDashboard';
import ExamTaker from './components/ExamTaker';
import { GraduationCap, School, ChevronRight, AlertCircle, ChevronLeft, Download, Check, Sparkles, Heart, Wifi, Zap } from 'lucide-react';

type LoginStep = 'LOGIN' | 'SELECT_TEAM';

const App: React.FC = () => {
  const [role, setRole] = useState<UserRole>(null);
  
  // Login State
  const [loginStep, setLoginStep] = useState<LoginStep>('LOGIN');
  const [roomId, setRoomId] = useState(''); 
  const [studentName, setStudentName] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');

  // Data State
  const [activeExam, setActiveExam] = useState<Exam | null>(null);
  const [availableTeams, setAvailableTeams] = useState<Team[]>([]);
  
  // Import State
  const [showImport, setShowImport] = useState(false);
  const [importDataText, setImportDataText] = useState('');
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [importMessage, setImportMessage] = useState('');

  const handleConnectToRoom = async () => {
    if (!studentName.trim()) {
        setError('Bạn quên nhập tên rồi nè! 🌱');
        return;
    }
    if (!roomId.trim()) {
        setError("Nhập Mã Phòng do giáo viên cung cấp nha!");
        return;
    }

    setIsConnecting(true);
    setError('');

    try {
         // Initialize P2P client
        await p2pService.initialize();
        
        // AUTO-PREFIX "EQ-" for students to keep ID simple
        const targetId = 'EQ-' + roomId.trim().toUpperCase();
        const conn = await p2pService.connect(targetId);

        // Notify teacher that I am connecting (just name for now)
        p2pService.send({ type: 'STUDENT_JOIN', payload: { name: studentName.trim() } }, conn);

        // Wait for SYNC_EXAM message which contains EXAM + TEAMS
        p2pService.onData((msg) => {
             if (msg.type === 'SYNC_EXAM') {
                 // Payload structure: { exam: Exam, teams: Team[] }
                 const { exam, teams } = msg.payload;
                 
                 if (exam && teams) {
                     setActiveExam(exam);
                     setAvailableTeams(teams);
                     setLoginStep('SELECT_TEAM'); // Move to team selection
                     setIsConnecting(false);
                 }
             }
        });

        // Timeout if no response
        setTimeout(() => {
            if (loginStep === 'LOGIN') { // If still stuck on login
                setIsConnecting(false);
                setError("Kết nối được nhưng không thấy phản hồi từ Giáo Viên. Hãy thử lại.");
            }
        }, 10000);

    } catch (e) {
        console.error(e);
        setIsConnecting(false);
        setError("Không tìm thấy phòng thi này. Hãy kiểm tra lại mã trên màn hình giáo viên!");
    }
  }

  const handleEnterLobby = () => {
      if (!selectedTeam) return;

      // Notify teacher about the team selection
      p2pService.send({ 
          type: 'PLAYER_READY', 
          payload: { 
              name: studentName, 
              team: availableTeams.find(t => t.id === selectedTeam)?.name || 'Khác' 
          } 
      });

      // Save session info
      registerStudentSession({
        examId: activeExam!.id,
        studentName: studentName.trim(),
        team: availableTeams.find(t => t.id === selectedTeam)?.name || 'Khác',
        joinedAt: Date.now()
    });
  }

  const handleImport = () => {
      if(!importDataText) return;
      const result = importData(importDataText);
      if(result.success) {
          setImportStatus('success');
          setImportMessage(result.message);
          setTimeout(() => {
              setImportStatus('idle');
              setShowImport(false);
              setImportDataText('');
              setImportMessage('');
              if (result.type === 'EXAM') {
                  alert(result.message);
              } else {
                  alert(result.message + "\nVào Bảng Điều Khiển để xem kết quả.");
              }
          }, 2000);
      } else {
          setImportStatus('error');
          setImportMessage(result.message);
      }
  }

  if (role === 'TEACHER') {
    return <TeacherDashboard onBack={() => setRole(null)} />;
  }

  // EXAM TAKER VIEW (Only when exam is set AND team is selected)
  if (activeExam && studentName && selectedTeam && loginStep === 'SELECT_TEAM') {
      // Check if we "Entered Lobby" by confirming selection.
      // Actually we can render ExamTaker and handle Lobby state inside it (as we did previously)
      return (
        <ExamTaker 
            exam={activeExam} 
            studentName={studentName}
            team={availableTeams.find(t => t.id === selectedTeam)?.name || 'Không xác định'} 
            isP2P={true} // Always P2P
            onExit={() => {
                setActiveExam(null);
                setStudentName('');
                setRoomId('');
                setLoginStep('LOGIN');
                setRole(null);
                p2pService.destroy();
            }} 
        />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-100 via-blue-100 to-indigo-100 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      
      {/* Decorative Blobs */}
      <div className="absolute top-10 left-10 w-32 h-32 bg-white rounded-full mix-blend-overlay filter blur-xl opacity-70 animate-float"></div>
      <div className="absolute top-20 right-20 w-40 h-40 bg-cyan-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-float-delayed"></div>
      <div className="absolute -bottom-10 left-1/2 w-52 h-52 bg-indigo-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-float"></div>

      <div className="max-w-md w-full relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-tr from-cyan-500 to-blue-500 rounded-3xl shadow-lg shadow-cyan-200 mb-4 transform rotate-3 hover:rotate-6 transition-transform">
            <School className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-extrabold text-slate-800 tracking-tight flex items-center justify-center gap-2">
            EduQuiz <Zap className="w-6 h-6 text-yellow-400 fill-current animate-pulse" />
          </h1>
          <p className="text-slate-600/70 mt-2 font-medium">Nền tảng thi trực tuyến tốc độ cao</p>
        </div>

        {role === null ? (
          <div className="space-y-4">
            <button
              onClick={() => setRole('STUDENT')}
              className="w-full bg-white/80 backdrop-blur-sm p-6 rounded-3xl shadow-sm border-2 border-white flex items-center justify-between hover:shadow-xl hover:scale-105 hover:border-cyan-200 transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-cyan-100 rounded-2xl flex items-center justify-center text-cyan-600 group-hover:bg-cyan-200 transition-colors">
                  <GraduationCap className="w-7 h-7" />
                </div>
                <div className="text-left">
                  <h3 className="font-bold text-lg text-gray-800 group-hover:text-cyan-600 transition-colors">Học Sinh</h3>
                  <p className="text-sm text-gray-500 font-medium">Tham gia phòng thi</p>
                </div>
              </div>
              <ChevronRight className="w-6 h-6 text-gray-300 group-hover:text-cyan-500 transition-colors bg-gray-50 rounded-full p-1" />
            </button>

            <button
              onClick={() => setRole('TEACHER')}
              className="w-full bg-white/80 backdrop-blur-sm p-6 rounded-3xl shadow-sm border-2 border-white flex items-center justify-between hover:shadow-xl hover:scale-105 hover:border-indigo-200 transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:bg-indigo-200 transition-colors">
                  <School className="w-7 h-7" />
                </div>
                <div className="text-left">
                  <h3 className="font-bold text-lg text-gray-800 group-hover:text-indigo-600 transition-colors">Giáo Viên</h3>
                  <p className="text-sm text-gray-500 font-medium">Tổ chức thi & Quản lý</p>
                </div>
              </div>
              <ChevronRight className="w-6 h-6 text-gray-300 group-hover:text-indigo-500 transition-colors bg-gray-50 rounded-full p-1" />
            </button>
            
            {/* Unified Import Button (Mostly for Teacher now, but kept accessible) */}
            <button 
                onClick={() => setShowImport(true)}
                className="w-full py-3 bg-transparent border-2 border-dashed border-slate-300 text-slate-500 rounded-2xl text-xs font-bold hover:border-indigo-300 hover:text-indigo-500 hover:bg-white/50 transition-all flex items-center justify-center gap-2"
            >
                <Download className="w-4 h-4" /> Nạp Dữ Liệu (Backup)
            </button>
          </div>
        ) : (
            // Student Login View
          <div className="bg-white/90 backdrop-blur-md p-8 rounded-[2rem] shadow-2xl border border-white relative animate-slide-up">
             <button 
                onClick={() => {
                    setRole(null);
                    setLoginStep('LOGIN');
                    p2pService.destroy();
                }} 
                className="absolute top-5 left-5 px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors flex items-center gap-1 font-bold text-sm z-20"
                title="Quay lại"
             >
                 <ChevronLeft className="w-4 h-4" /> Quay lại
             </button>
             
             {/* IMPORT MODAL OVERLAY */}
             {showImport && (
                 <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-20 rounded-[2rem] flex flex-col items-center justify-center p-6 animate-fade-in text-center">
                     <h3 className="font-bold text-xl mb-2 text-indigo-800 flex items-center justify-center gap-2"><Sparkles className="w-5 h-5 text-yellow-400"/> Nạp Dữ Liệu</h3>
                     <p className="text-xs text-gray-500 text-center mb-4 px-4">
                         Dán mã đề thi (nếu là HS) hoặc mã kết quả bài làm (nếu là GV) vào đây.
                     </p>
                     <textarea 
                        value={importDataText}
                        onChange={(e) => setImportDataText(e.target.value)}
                        placeholder='Dán mã JSON vào đây...'
                        className="w-full h-32 p-4 bg-gray-50 border-2 border-dashed border-indigo-200 rounded-2xl text-xs font-mono mb-4 focus:border-indigo-500 outline-none resize-none transition-all"
                     />
                     {importMessage && <p className={`text-xs font-bold mb-3 ${importStatus === 'error' ? 'text-red-500' : 'text-emerald-500'}`}>{importMessage}</p>}
                     
                     <div className="flex gap-3 w-full">
                         <button onClick={() => setShowImport(false)} className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl font-bold text-gray-600 transition-colors">Đóng</button>
                         <button 
                            onClick={handleImport}
                            className={`flex-1 py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all ${importStatus === 'error' ? 'bg-red-400' : 'bg-gradient-to-r from-indigo-500 to-purple-500 hover:scale-105'}`}
                         >
                             {importStatus === 'success' ? <Check className="w-5 h-5" /> : <Download className="w-5 h-5" />}
                             {importStatus === 'success' ? 'Xong!' : 'Nạp Ngay'}
                         </button>
                     </div>
                 </div>
             )}

            <h2 className="text-2xl font-extrabold text-slate-800 mb-6 text-center mt-8 flex items-center justify-center gap-2">
                <Wifi className="w-8 h-8 text-cyan-500" /> Kết Nối Phòng Thi
            </h2>
            
            {loginStep === 'LOGIN' ? (
                <div className="space-y-5 animate-fade-in">
                  <div>
                     <label className="block text-sm font-bold text-slate-500 mb-2 ml-1">Tên của bạn</label>
                     <input
                        type="text"
                        value={studentName}
                        onChange={(e) => setStudentName(e.target.value)}
                        placeholder="VD: Bé Bi 💖"
                        className="w-full p-4 border-2 border-slate-100 rounded-2xl bg-slate-50 focus:bg-white focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100 outline-none transition-all font-medium"
                      />
                  </div>
    
                  <div>
                      <label className="block text-sm font-bold text-cyan-600 mb-2 ml-1 flex items-center gap-1">Mã Phòng</label>
                      <input
                        type="text"
                        inputMode="text"
                        value={roomId}
                        onChange={(e) => setRoomId(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                        placeholder="VD: LOP5A"
                        maxLength={10}
                        className="w-full p-4 border-2 border-cyan-100 rounded-2xl bg-cyan-50/50 focus:bg-white focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100 outline-none font-mono tracking-widest text-center text-2xl text-cyan-600 font-black transition-all placeholder-cyan-200 uppercase"
                      />
                  </div>
    
                  {error && (
                    <div className="flex items-center gap-3 text-rose-600 bg-rose-50 p-4 rounded-2xl text-sm font-medium border border-rose-100 animate-pulse">
                      <AlertCircle className="w-5 h-5 flex-shrink-0" />
                      {error}
                    </div>
                  )}
                  
                  <div className="pt-2 flex flex-col gap-3">
                      <button
                        onClick={handleConnectToRoom}
                        disabled={isConnecting}
                        className={`w-full text-white py-4 rounded-2xl font-bold text-lg shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 ${isConnecting ? 'bg-slate-300 cursor-not-allowed' : 'bg-gradient-to-r from-cyan-500 to-blue-500 shadow-cyan-200'}`}
                      >
                        {isConnecting ? <Sparkles className="w-5 h-5 animate-spin"/> : <Wifi className="w-5 h-5" />}
                        {isConnecting ? 'Đang kết nối...' : 'Tiếp Tục'} 
                      </button>
                  </div>
                </div>
            ) : (
                <div className="space-y-5 animate-slide-up">
                    <div className="text-center mb-4">
                        <p className="text-slate-500 font-medium">Xin chào <span className="text-cyan-600 font-bold">{studentName}</span>!</p>
                        <p className="text-sm text-slate-400">Hãy chọn đội của bạn để bắt đầu.</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 max-h-60 overflow-y-auto custom-scrollbar p-1">
                        {availableTeams.map(team => (
                            <button
                                key={team.id}
                                onClick={() => setSelectedTeam(team.id)}
                                className={`p-4 rounded-2xl text-sm font-bold transition-all transform hover:scale-[1.02] active:scale-95 ${
                                    selectedTeam === team.id 
                                    ? team.color + ' shadow-lg ring-4 ring-offset-2 ring-cyan-200 scale-[1.02]' 
                                    : 'bg-white border-2 border-slate-100 text-slate-500 hover:border-cyan-200 hover:text-cyan-600'
                                }`}
                            >
                                {team.name}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={handleEnterLobby}
                        disabled={!selectedTeam}
                        className={`w-full text-white py-4 rounded-2xl font-bold text-lg shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 ${!selectedTeam ? 'bg-slate-300 cursor-not-allowed' : 'bg-gradient-to-r from-emerald-400 to-teal-500 shadow-emerald-200'}`}
                    >
                        Vào Phòng Thi <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
            )}
          </div>
        )}
      </div>
      
      <div className="fixed bottom-4 text-center text-xs font-medium text-slate-400">
         Made with <Heart className="w-3 h-3 inline text-pink-400 fill-current animate-bounce" /> by EduQuiz
      </div>
    </div>
  );
};

export default App;