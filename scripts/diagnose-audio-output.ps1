# 預設唯讀，不錄音。明確指定 Edge PID 時才會取消其系統靜音並設為 60%。
param([uint32]$UnmuteEdgeProcessId = 0)
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class Enumerator {}
[ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface DeviceEnum {
 [PreserveSig] int EnumAudioEndpoints(int flow,int mask,out Devices devices);
}
[ComImport, Guid("0BD7A1BE-7A1A-44DB-8397-CC5392387B5E"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface Devices {
 [PreserveSig] int GetCount(out uint count); [PreserveSig] int Item(uint index,out Device device);
}
[ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface Device {
 [PreserveSig] int Activate(ref Guid iid,int context,IntPtr activation,[MarshalAs(UnmanagedType.IUnknown)] out object instance);
}
[ComImport, Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface Endpoint {
 [PreserveSig] int RegisterControlChangeNotify(IntPtr p); [PreserveSig] int UnregisterControlChangeNotify(IntPtr p);
 [PreserveSig] int GetChannelCount(out uint c); [PreserveSig] int SetMasterVolumeLevel(float v,IntPtr g);
 [PreserveSig] int SetMasterVolumeLevelScalar(float v,IntPtr g); [PreserveSig] int GetMasterVolumeLevel(out float v);
 [PreserveSig] int GetMasterVolumeLevelScalar(out float v); [PreserveSig] int SetChannelVolumeLevel(uint c,float v,IntPtr g);
 [PreserveSig] int SetChannelVolumeLevelScalar(uint c,float v,IntPtr g); [PreserveSig] int GetChannelVolumeLevel(uint c,out float v);
 [PreserveSig] int GetChannelVolumeLevelScalar(uint c,out float v); [PreserveSig] int SetMute(bool m,IntPtr g);
 [PreserveSig] int GetMute([MarshalAs(UnmanagedType.Bool)] out bool m);
}
[ComImport, Guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface Manager {
 [PreserveSig] int GetAudioSessionControl(IntPtr g,int f,out IntPtr c);
 [PreserveSig] int GetSimpleAudioVolume(IntPtr g,int f,out IntPtr c); [PreserveSig] int GetSessionEnumerator(out Sessions s);
}
[ComImport, Guid("E2F5BB11-0570-40CA-ACDD-3AA01277DEE8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface Sessions {
 [PreserveSig] int GetCount(out int c); [PreserveSig] int GetSession(int i,out Control c);
}
[ComImport, Guid("BFB7FF88-7239-4FC9-8FA2-07C950BE9C6D"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface Control {
 [PreserveSig] int GetState(out int s); [PreserveSig] int GetDisplayName(out IntPtr n); [PreserveSig] int SetDisplayName(IntPtr n,IntPtr g);
 [PreserveSig] int GetIconPath(out IntPtr n); [PreserveSig] int SetIconPath(IntPtr n,IntPtr g); [PreserveSig] int GetGroupingParam(out Guid g);
 [PreserveSig] int SetGroupingParam(ref Guid g,IntPtr e); [PreserveSig] int RegisterAudioSessionNotification(IntPtr p);
 [PreserveSig] int UnregisterAudioSessionNotification(IntPtr p); [PreserveSig] int GetSessionIdentifier(out IntPtr s);
 [PreserveSig] int GetSessionInstanceIdentifier(out IntPtr s); [PreserveSig] int GetProcessId(out uint pid);
}
[ComImport, Guid("87CE5498-68D6-44E5-9215-6DA47EF883D8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface SessionVolume {
 [PreserveSig] int SetMasterVolume(float v,IntPtr g); [PreserveSig] int GetMasterVolume(out float v);
 [PreserveSig] int SetMute(bool m,IntPtr g); [PreserveSig] int GetMute([MarshalAs(UnmanagedType.Bool)] out bool m);
}
[ComImport, Guid("C02216F6-8C67-4B5B-9D00-D008E73E0064"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface Meter {
 [PreserveSig] int GetPeakValue(out float p);
}
public class AudioProbe {
 public static void Run(uint unmuteEdgePid) {
  var en=(DeviceEnum)new Enumerator(); Devices ds; Marshal.ThrowExceptionForHR(en.EnumAudioEndpoints(0,1,out ds)); uint count; ds.GetCount(out count);
  for(uint i=0;i<count;i++) {
   Device d; ds.Item(i,out d); object o; var id=typeof(Endpoint).GUID;
   Marshal.ThrowExceptionForHR(d.Activate(ref id,23,IntPtr.Zero,out o)); var ep=(Endpoint)o;
   float v; bool m; ep.GetMasterVolumeLevelScalar(out v); ep.GetMute(out m);
   Console.WriteLine("Output {0}: volume={1:0}% muted={2}",i,v*100,m); Marshal.ReleaseComObject(o);
   id=typeof(Manager).GUID; Marshal.ThrowExceptionForHR(d.Activate(ref id,23,IntPtr.Zero,out o)); Sessions ss; ((Manager)o).GetSessionEnumerator(out ss); int c; ss.GetCount(out c);
   for(int j=0;j<c;j++) {
    Control ctrl; ss.GetSession(j,out ctrl); uint pid; int state; ctrl.GetProcessId(out pid); ctrl.GetState(out state); string name="system";
    try { name=System.Diagnostics.Process.GetProcessById((int)pid).ProcessName; } catch {}
    if(name=="msedge"||name=="chrome"||name=="Codex") {
     var sv=(SessionVolume)ctrl;
     if(unmuteEdgePid!=0 && pid==unmuteEdgePid && name=="msedge") {
      Marshal.ThrowExceptionForHR(sv.SetMasterVolume(0.6f,IntPtr.Zero));
      Marshal.ThrowExceptionForHR(sv.SetMute(false,IntPtr.Zero));
     }
     sv.GetMasterVolume(out v); sv.GetMute(out m); float peak=0;
     try { for(int n=0;n<5;n++) { float p; ((Meter)ctrl).GetPeakValue(out p); peak=Math.Max(peak,p); System.Threading.Thread.Sleep(30); } } catch {}
     Console.WriteLine("  {0} pid={1} active={2} volume={3:0}% muted={4} peak={5:0.000000}",name,pid,state==1,v*100,m,peak);
    }
    Marshal.ReleaseComObject(ctrl);
   }
   Marshal.ReleaseComObject(ss); Marshal.ReleaseComObject(o); Marshal.ReleaseComObject(d);
  }
  Marshal.ReleaseComObject(ds); Marshal.ReleaseComObject(en);
 }
}
'@
[AudioProbe]::Run($UnmuteEdgeProcessId)
