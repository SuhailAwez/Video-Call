
"use client";

import type { ChatMessage } from '@/types';
import type PeerJS from 'peerjs';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { summarizeChatHistory } from '@/ai/flows/summarize-chat';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'; // Added Dialog
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Mic, MicOff, Video, VideoOff, Send, PhoneOff, Copy, MessageSquareText, Sparkles, Users, Link2, ScreenShare, ScreenShareOff, Paperclip, X, ClipboardPaste, Brush } from 'lucide-react'; // Added Brush
import { format } from 'date-fns';
import Whiteboard from '@/components/Whiteboard'; // Added Whiteboard import

export default function ChronoConnectClient() {
  const { toast } = useToast();
  const [peerJsLib, setPeerJsLib] = useState<typeof PeerJS | null>(null);

  const [peerId, setPeerId] = useState<string>('');
  
  const peerInstance = useRef<PeerJS | null>(null);
  const mainVideoRef = useRef<HTMLVideoElement>(null); 
  
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null); 
  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  const remoteStreamRef = useRef<MediaStream | null>(null);
  // useEffect for remoteStreamRef not strictly needed if not directly using remoteStream state for rendering
  
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState<string>('');
  
  const [isCallActive, setIsCallActive] = useState<boolean>(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState<boolean>(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState<boolean>(true);

  const [summary, setSummary] = useState<string | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState<boolean>(false);
  const [showSummaryDialog, setShowSummaryDialog] = useState<boolean>(false);

  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);

  const callRef = useRef<PeerJS.MediaConnection | null>(null);
  const dataConnectionRef = useRef<PeerJS.DataConnection | null>(null);

  const [isScreenSharing, setIsScreenSharing] = useState<boolean>(false);
  const cameraStreamRef = useRef<MediaStream | null>(null); 
  const isScreenSharingRef = useRef(isScreenSharing); 
  useEffect(() => {
    isScreenSharingRef.current = isScreenSharing;
  }, [isScreenSharing]);

  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [isChatConnected, setIsChatConnected] = useState<boolean>(false);
  const [isWhiteboardOpen, setIsWhiteboardOpen] = useState<boolean>(false); // State for whiteboard

  // State for document upload
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedDocumentText, setSelectedDocumentText] = useState<string | null>(null);
  const [isFileReading, setIsFileReading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleChat = () => setIsChatOpen(prev => !prev);

  const handleSummarizeChat = useCallback(async () => {
    if (chatMessages.length === 0) {
      setSummary("No chat messages to summarize.");
      setShowSummaryDialog(true);
      return;
    }

    setIsLoadingSummary(true);
    const chatHistoryString = chatMessages
      .map(msg => `${msg.sender === 'me' ? 'You' : 'Them'} (${msg.timestamp}): ${msg.text}`)
      .join('\n');
    
    try {
      const result = await summarizeChatHistory({ chatHistory: chatHistoryString });
      setSummary(result.summary);
    } catch (error) {
      console.error("Summarization error:", error);
      let description = "Failed to summarize chat. Please try again.";
      if (error instanceof Error && error.message) {
        description = `Error: ${error.message}`;
      }
      setSummary(description);
      toast({ title: "Summarization Error", description, variant: "destructive" });
    } finally {
      setIsLoadingSummary(false);
      setShowSummaryDialog(true);
    }
  }, [chatMessages, toast]); 

  const endCall = useCallback(async () => {
    if (isScreenSharingRef.current) { 
      const screenStream = localStreamRef.current; 
      screenStream?.getTracks().forEach(track => track.stop());
      if (cameraStreamRef.current && cameraStreamRef.current.active) {
        setLocalStream(cameraStreamRef.current); 
      } else {
        setLocalStream(null); 
      }
      setIsScreenSharing(false); 
    }

    callRef.current?.close();
    dataConnectionRef.current?.close(); 
    
    // Don't stop remoteStream tracks as they are handled by PeerJS and might be used by audio element
    // remoteStreamRef.current?.getTracks().forEach(track => track.stop()); 
    // setRemoteStream(null); // Remote stream state is not directly used for video rendering
    
    setIsCallActive(false);
    setIsChatConnected(false); // Ensure chat is marked as disconnected
    
    toast({ title: "Call Ended" });
  }, [toast]); // Removed localStream, remoteStream, cameraStreamRef from deps, as they are accessed via refs or state setters

  const endCallRef = useRef(endCall);
  useEffect(() => {
    endCallRef.current = endCall;
  }, [endCall]);


  useEffect(() => {
    if (typeof window !== 'undefined') {
      import('peerjs').then(module => {
        setPeerJsLib(() => module.default);
      }).catch(err => {
        console.error("Failed to load PeerJS:", err);
        toast({ title: "Error", description: "PeerJS library failed to load.", variant: "destructive" });
      });
    }
  }, [toast]);

  const getInitialMedia = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast({
        variant: 'destructive',
        title: 'Media Not Supported',
        description: 'Your browser does not support media devices or getUserMedia API.',
      });
      setHasCameraPermission(false);
      setLocalStream(null);
      cameraStreamRef.current = null;
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      cameraStreamRef.current = stream; 
      setHasCameraPermission(true);
    } catch (error) {
      console.error("Error accessing media devices for initial setup:", error);
      setHasCameraPermission(false);
      setLocalStream(null); 
      cameraStreamRef.current = null;
      toast({
        variant: 'destructive',
        title: 'Camera/Microphone Access Denied',
        description: 'Please enable camera and microphone permissions in your browser settings to use this app.',
      });
    }
  }, [toast]); 


  useEffect(() => {
    if (typeof window !== 'undefined' && hasCameraPermission === null) { 
      getInitialMedia();
    }
  }, [getInitialMedia, hasCameraPermission]);

 useEffect(() => {
    const mainVideoEl = mainVideoRef.current;
    if (!mainVideoEl) return;

    let streamToDisplay: MediaStream | null = null;

    if (isScreenSharingRef.current && localStreamRef.current) {
      streamToDisplay = localStreamRef.current; // Show screen share
    } else if (localStreamRef.current && hasCameraPermission === true) { 
      streamToDisplay = localStreamRef.current; // Show local camera
    } else {
      streamToDisplay = null;
    }
    
    if (mainVideoEl.srcObject !== streamToDisplay) {
      mainVideoEl.srcObject = streamToDisplay;       
    }
    // Always mute if showing local feed (camera or screen share)
    mainVideoEl.muted = true;


    if (streamToDisplay && mainVideoEl.paused) {
      mainVideoEl.play().catch(error => {
          console.warn("Video play failed (this is often due to browser autoplay policies):", error);
      });
    } else if (!streamToDisplay && !mainVideoEl.paused) {
        mainVideoEl.pause();
    }
  }, [localStream, hasCameraPermission, isScreenSharing]);


  const initializePeer = useCallback((loadedPeer: typeof PeerJS) => {
    if (!loadedPeer) {
      toast({ title: "Error", description: "PeerJS library not loaded for initialization.", variant: "destructive" });
      return;
    }
    
    if (peerInstance.current) {
      peerInstance.current.destroy();
    }
    
    const newPeer = new loadedPeer(undefined, {
       debug: 2 
    });
    peerInstance.current = newPeer;

    newPeer.on('open', (id) => {
      setPeerId(id);
    });

    newPeer.on('call', (call) => {
      const streamToAnswerWith = localStreamRef.current || new MediaStream(); // Use local stream if available
      
      call.answer(streamToAnswerWith);
      setIsCallActive(true);
      callRef.current = call;

      call.on('stream', (incomingRemoteStream) => {
        // For "show only my side video", we don't display remote video.
        // But we need its audio.
        const remoteAudioElement = document.createElement('audio');
        remoteAudioElement.srcObject = incomingRemoteStream;
        remoteAudioElement.autoplay = true;
        document.body.appendChild(remoteAudioElement); // Needs to be in DOM to play
        
        // Store the remote stream if needed for other purposes (e.g., direct audio controls)
        remoteStreamRef.current = incomingRemoteStream;

        // Cleanup the audio element when call ends or stream closes
        const cleanupAudio = () => {
          remoteAudioElement.remove();
          incomingRemoteStream.getTracks().forEach(track => track.stop());
        };
        call.on('close', cleanupAudio);
        incomingRemoteStream.onremovetrack = cleanupAudio; // Or oninactive
      });

      call.on('close', () => {
        endCallRef.current();
      });
      call.on('error', (err) => {
        toast({ title: "Call Error", description: err.message, variant: "destructive"});
        endCallRef.current();
      });
    });

    newPeer.on('connection', (conn) => {
      if (dataConnectionRef.current && dataConnectionRef.current.open) { 
        dataConnectionRef.current.close();
      }
      dataConnectionRef.current = conn;
      setIsChatConnected(true); 
      conn.on('data', (data) => {
        const message = data as { text: string }; 
        setChatMessages((prev) => [...prev, { id: crypto.randomUUID(), sender: 'them', text: message.text, timestamp: format(new Date(), 'p') }]);
      });
      conn.on('open', () => {
         toast({ title: "Chat Connected", description: `Chat established with ${conn.peer}`});
         setIsChatConnected(true);
      });
       conn.on('close', () => {
        toast({ title: "Chat Disconnected", description: `Chat with ${conn.peer} ended.`});
        if (dataConnectionRef.current?.peer === conn.peer) {
          dataConnectionRef.current = null;
        }
        setIsChatConnected(false);
      });
      conn.on('error', (err) => {
        toast({ title: "Chat Error", description: `Chat connection error: ${err.type}`, variant: "destructive" });
        setIsChatConnected(false);
      });
    });
    
    newPeer.on('error', (err) => {
      console.error("PeerJS Error: ", err);
      toast({ title: "Connection Error", description: `PeerJS error: ${err.type}. Check console.`, variant: "destructive" });
       if (err.type === 'unavailable-id') {
        peerInstance.current?.destroy(); 
        peerInstance.current = null;
        setTimeout(() => initializePeer(loadedPeer), 1000); 
      }
    });

  }, [toast]); 

  useEffect(() => {
    if (peerJsLib && hasCameraPermission !== null && !peerInstance.current) { 
      initializePeer(peerJsLib);
    }
    // No return cleanup here to destroy peerInstance, it's handled on component unmount or re-init
  }, [peerJsLib, initializePeer, hasCameraPermission]);

  // Effect for cleaning up PeerJS and streams on component unmount
  useEffect(() => {
    return () => {
      // Stop local camera stream tracks
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach(track => track.stop());
        cameraStreamRef.current = null;
      }
      // Stop current local stream if it's different from camera (e.g. screen share)
      if (localStreamRef.current && localStreamRef.current !== cameraStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      setLocalStream(null); // Clear local stream state

      // Stop remote stream tracks
      if (remoteStreamRef.current) {
          remoteStreamRef.current.getTracks().forEach(track => track.stop());
          remoteStreamRef.current = null;
      }
      // setRemoteStream(null); // Clear remote stream state

      // Close PeerJS connections
      if (callRef.current) {
        callRef.current.close();
        callRef.current = null;
      }
      if (dataConnectionRef.current && dataConnectionRef.current.open) {
        dataConnectionRef.current.close();
        dataConnectionRef.current = null;
      }
      
      // Destroy PeerJS instance
      if (peerInstance.current) {
        peerInstance.current.destroy();
        peerInstance.current = null;
      }
    };
  }, []);


  const handleSendMessage = () => {
    if (!currentMessage.trim()) {
      return;
    }
    
    const newMessage: ChatMessage = { 
      id: crypto.randomUUID(), 
      sender: 'me', 
      text: currentMessage, 
      timestamp: format(new Date(), 'p') 
    };
    setChatMessages((prev) => [...prev, newMessage]);
    
    if (isChatConnected && dataConnectionRef.current && dataConnectionRef.current.open) {
        const messageData = { text: currentMessage };
        dataConnectionRef.current.send(messageData);
    }
    setCurrentMessage('');
  };

  const toggleMediaTrack = (type: 'video' | 'audio', enabled: boolean) => {
    let streamToControl: MediaStream | null = null;
    // When screen sharing, audio toggle should affect the screen share stream if it has audio.
    // Video toggle should only affect the camera stream, and is disabled during screen share.
    if (type === 'video' && !isScreenSharingRef.current) {
        streamToControl = cameraStreamRef.current; 
    } else if (type === 'audio') {
        streamToControl = localStreamRef.current; // This could be camera or screen share audio
    }
    
    if (!streamToControl) {
      toast({ title: "Media Error", description: "Local stream is not available to toggle.", variant: "destructive" });
      if (type === 'video') setIsVideoEnabled(false);
      if (type === 'audio') setIsAudioEnabled(false);
      return;
    }

    streamToControl.getTracks().forEach(track => {
      if (track.kind === type) {
        track.enabled = enabled;
      }
    });

    if (type === 'video') setIsVideoEnabled(enabled);
    if (type === 'audio') setIsAudioEnabled(enabled);
  };
  
  const toggleScreenShare = async () => {
    const videoSender = callRef.current?.peerConnection?.getSenders().find(sender => sender.track?.kind === 'video');
    
    const stopSharingLogic = async (notifyUser = true) => {
      if (!isScreenSharingRef.current) return; 

      const screenStreamBeingStopped = localStreamRef.current; 

      if (videoSender && isCallActive) { 
        if (cameraStreamRef.current && cameraStreamRef.current.getVideoTracks().length > 0 && cameraStreamRef.current.active) {
          const cameraVideoTrack = cameraStreamRef.current.getVideoTracks()[0];
          if (videoSender.track !== cameraVideoTrack && cameraVideoTrack.enabled) { 
            try {
              await videoSender.replaceTrack(cameraVideoTrack);
            } catch (err) { console.error("Error replacing track to camera:", err); }
          } else if (!cameraVideoTrack.enabled && videoSender.track){ 
             try { await videoSender.replaceTrack(null); } catch (err) { console.error("Error replacing track with null (camera disabled):", err); }
          }
          setLocalStream(cameraStreamRef.current); 
        } else { 
          setLocalStream(null); 
          if (videoSender.track) { 
            try {
              await videoSender.replaceTrack(null);
            } catch (err) { console.error("Error replacing track with null:", err); }
          }
        }
      } else { 
        if (cameraStreamRef.current && cameraStreamRef.current.active) {
            setLocalStream(cameraStreamRef.current);
        } else {
            setLocalStream(null);
        }
      }
      
      if (screenStreamBeingStopped && screenStreamBeingStopped !== cameraStreamRef.current) {
          screenStreamBeingStopped.getTracks().forEach(track => track.stop());
      }

      setIsScreenSharing(false); 
      if (notifyUser) toast({ title: "Screen Sharing Ended" });
    };

    if (isScreenSharingRef.current) { 
      await stopSharingLogic();
    } else { 
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: { cursor: "always" }, audio: { suppressLocalAudioPlayback: true } });
        const screenVideoTrack = screenStream.getVideoTracks()[0];
        
        // No need to save cameraStreamRef.current here if it's already the designated camera stream.
        // cameraStreamRef.current should hold the original camera stream.
        // localStreamRef.current will become the screenStream.
        
        if (videoSender && screenVideoTrack && isCallActive) { 
          await videoSender.replaceTrack(screenVideoTrack);
        }
        
        setLocalStream(screenStream); 
        setIsScreenSharing(true);
        toast({ title: "Screen Sharing Started" });

        screenVideoTrack.onended = () => { 
          if (isScreenSharingRef.current) { 
            stopSharingLogic(); 
          }
        };
      } catch (error: any) {
        console.error("Error starting screen share:", error);
        let description = `Could not start screen sharing. ${error.message || ''}`;
        if (error.name === 'NotAllowedError') {
            description = "Screen sharing permission was denied. Please allow screen sharing in your browser and try again.";
        } else if (error.message && (error.message.includes("disallowed by permissions policy") || error.message.includes("Access to the feature"))) {
            description = "Screen sharing is disallowed by a permissions policy. If this app is in an iframe, the iframe may need the 'display-capture' permission. Otherwise, check browser/system settings.";
        }

        toast({ title: "Screen Share Error", description, variant: "destructive" });
        
        // Revert to camera stream if screen share fails
        if (cameraStreamRef.current && cameraStreamRef.current.active) {
            setLocalStream(cameraStreamRef.current);
        } else {
            setLocalStream(null);
        }
        setIsScreenSharing(false); 

        if (videoSender && cameraStreamRef.current && cameraStreamRef.current.getVideoTracks().length > 0 && cameraStreamRef.current.active && isCallActive) {
            const cameraTrack = cameraStreamRef.current.getVideoTracks()[0];
            if(cameraTrack && cameraTrack.enabled) { 
              try {
                await videoSender.replaceTrack(cameraTrack);
              } catch (revertError) {
                console.error("Error reverting to camera track on screen share fail:", revertError);
              }
            } else if (videoSender.track) { 
                try { await videoSender.replaceTrack(null); } catch (revertError) { console.error("Error reverting to null track on screen share fail:", revertError); }
            }
        }
      }
    }
  };

  const copyPeerId = () => {
    if (!peerId) return;
    navigator.clipboard.writeText(peerId)
      .then(() => toast({ title: "Copied!", description: "Your Peer ID has been copied to the clipboard." }))
      .catch(() => toast({ title: "Error", description: "Failed to copy Peer ID.", variant: "destructive" }));
  };

  const handleFileUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type === "text/plain" || file.name.endsWith(".md")) {
        setIsFileReading(true);
        setSelectedFile(file);
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const textContent = e.target?.result as string;
            setSelectedDocumentText(textContent);
          } catch (readError) {
            console.error("Error reading file content:", readError);
            toast({ title: "File Read Error", description: "Could not read file content.", variant: "destructive" });
            setSelectedFile(null);
            setSelectedDocumentText(null);
          } finally {
            setIsFileReading(false);
          }
        };
        reader.onerror = () => {
          console.error("FileReader error");
          toast({ title: "File Read Error", description: "An error occurred while reading the file.", variant: "destructive" });
          setSelectedFile(null);
          setSelectedDocumentText(null);
          setIsFileReading(false);
        };
        reader.readAsText(file);
      } else {
        toast({ title: "Invalid File Type", description: "Please select a .txt or .md file.", variant: "destructive" });
        setSelectedFile(null);
        setSelectedDocumentText(null);
      }
    } else {
      setSelectedFile(null);
      setSelectedDocumentText(null);
    }
    if (event.target) {
      event.target.value = "";
    }
  };

  const handleInsertFileContent = () => {
    if (selectedDocumentText) {
      setCurrentMessage(prev => prev + selectedDocumentText); // Append instead of replacing
      setSelectedFile(null); // Clear after inserting
      setSelectedDocumentText(null);
    }
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    setSelectedDocumentText(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };


  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Main Video and Controls Area */}
      <div className="flex-grow flex flex-col relative">
        {/* Video Display Area */}
        <div className="flex-grow bg-black flex items-center justify-center relative h-full">
          <video ref={mainVideoRef} autoPlay playsInline className="w-full h-full object-contain" data-ai-hint="local video conference" muted />
          {(!mainVideoRef.current?.srcObject) && ( 
             <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white p-4 text-center">
                <Users size={64} className="mb-4 text-gray-400"/>
                <p className="text-xl">
                  {hasCameraPermission === null && peerJsLib === null && "Initializing connection and camera..."}
                  {hasCameraPermission === null && peerJsLib !== null && "Initializing camera..."}
                  {hasCameraPermission === false && !isScreenSharing && "Camera permission denied. You can use audio, chat, and share your screen."}
                  {hasCameraPermission === false && isScreenSharing && "You are sharing your screen. Camera permission was denied."}
                  {hasCameraPermission === true && !isScreenSharing && localStream && "Your video is active. Waiting for connection or start screen share."}
                  {hasCameraPermission === true && !isScreenSharing && !localStream && "Video is off or unavailable. Turn on video or check permissions."}
                  {hasCameraPermission === true && isScreenSharing && "You are sharing your screen."}
                </p>
             </div>
          )}
        </div>

        {/* Controls Bar */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/70 via-black/50 to-transparent flex justify-center items-center space-x-3">
          <Button 
            variant={isAudioEnabled ? "secondary" : "destructive"} 
            size="lg" 
            onClick={() => toggleMediaTrack('audio', !isAudioEnabled)} 
            disabled={(hasCameraPermission === null && !isScreenSharing) || (!localStreamRef.current && !isScreenSharing)} 
            className="rounded-full p-3"
            title={isAudioEnabled ? "Mute Microphone" : "Unmute Microphone"}
          >
            {isAudioEnabled ? <Mic size={24} /> : <MicOff size={24} />}
          </Button>
          <Button 
            variant={isVideoEnabled ? "secondary" : "destructive"} 
            size="lg" 
            onClick={() => toggleMediaTrack('video', !isVideoEnabled)} 
            disabled={hasCameraPermission !== true || isScreenSharing} 
            className="rounded-full p-3"
            title={isVideoEnabled ? "Turn Off Camera" : "Turn On Camera"}
          >
            {isVideoEnabled ? <Video size={24} /> : <VideoOff size={24} />}
          </Button>
          <Button
            variant={isScreenSharing ? "destructive" : "secondary"}
            size="lg"
            onClick={toggleScreenShare}
            className="rounded-full p-3"
            title={isScreenSharing ? "Stop Sharing Screen" : "Share Screen"}
          >
            {isScreenSharing ? <ScreenShareOff size={24} /> : <ScreenShare size={24} />}
          </Button>
           <Button
            variant={isWhiteboardOpen ? "default" : "secondary"}
            size="lg"
            onClick={() => setIsWhiteboardOpen(prev => !prev)}
            className="rounded-full p-3"
            title={isWhiteboardOpen ? "Close Whiteboard" : "Open Whiteboard"}
          >
            <Brush size={24} />
          </Button>
          <Button
            variant={isChatOpen ? "default" : "secondary"}
            size="lg"
            onClick={toggleChat}
            className="rounded-full p-3"
            title={isChatOpen ? "Close Chat" : "Open Chat"}
          >
            <MessageSquareText size={24} />
          </Button>
          {isCallActive && (
            <Button 
              variant="destructive" 
              size="lg" 
              onClick={endCallRef.current}
              className="rounded-full p-3"
              title="End Call"
            >
              <PhoneOff size={24} />
            </Button>
          )}
        </div>
      </div>

      {/* Chat and Connection Info Panel (Togglable) */}
      {isChatOpen && (
        <div className="w-full md:w-[380px] flex-shrink-0 flex flex-col border-l border-border bg-card">
          {/* Connection Info Section */}
          <div className="p-4 space-y-4 border-b border-border">
            <CardTitle className="text-lg flex items-center gap-2"><Link2 className="text-primary"/> Share Your ID</CardTitle>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Your Peer ID:</p>
              <div className="flex items-center gap-2">
                <Input type="text" readOnly value={peerId || (peerJsLib ? "Initializing ID..." : "Loading lib...")} className="bg-muted text-sm"/>
                <Button variant="outline" size="icon" onClick={copyPeerId} disabled={!peerId} title="Copy Peer ID">
                  <Copy size={16}/>
                </Button>
              </div>
            </div>
            
            {hasCameraPermission === false && ( 
              <Alert variant="destructive" className="mt-2">
                <AlertTitle>Camera Access Denied</AlertTitle>
                <AlertDescription>
                  Camera access was denied. Microphone, chat, and screen sharing may still be available if those permissions were granted.
                </AlertDescription>
              </Alert>
            )}
             {hasCameraPermission === null && ( 
              <Alert variant="default" className="mt-2">
                <AlertTitle>Initializing Media</AlertTitle>
                <AlertDescription>
                  Attempting to access camera and microphone...
                </AlertDescription>
              </Alert>
            )}
          </div>
          
          {/* Chat Section */}
          <Card className="flex-grow flex flex-col shadow-none rounded-none border-none">
            <CardHeader className="pt-4 pb-2 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <MessageSquareText className="text-primary"/> Chat
                </CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleSummarizeChat}
                  disabled={isLoadingSummary || chatMessages.length === 0}
                  title="Summarize Chat (AI)"
                  className="text-accent hover:text-accent/80"
                >
                  <Sparkles size={20} />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex-grow overflow-hidden p-0">
              <ScrollArea className="h-full p-4">
                {chatMessages.length === 0 && !selectedFile && (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <MessageSquareText size={48} className="mb-2"/>
                    <p>Chat messages will appear here.</p>
                    {!isChatConnected && <p className="text-xs mt-1">(Connect to a peer to chat)</p>}
                  </div>
                )}
                {chatMessages.map((msg) => (
                  <div key={msg.id} className={`mb-3 p-3 rounded-lg shadow ${msg.sender === 'me' ? 'bg-primary text-primary-foreground ml-auto' : 'bg-secondary text-secondary-foreground mr-auto'}`} style={{maxWidth: '80%'}}>
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.text}</p>
                    <p className={`text-xs mt-1 ${msg.sender === 'me' ? 'text-right text-primary-foreground/80' : 'text-left text-secondary-foreground/80'}`}>{msg.timestamp}</p>
                  </div>
                ))}
              </ScrollArea>
            </CardContent>
            <CardFooter className="p-4 border-t border-border flex flex-col items-start">
              {selectedFile && (
                <div className="mb-2 p-2 border rounded-md bg-muted text-sm w-full">
                  <div className="flex justify-between items-center">
                    <span className="truncate pr-2">{selectedFile.name}</span>
                    <div className="flex-shrink-0">
                      <Button variant="ghost" size="sm" onClick={handleInsertFileContent} title="Insert file content into chat message" className="p-1 h-auto" disabled={!selectedDocumentText || isFileReading}>
                        <ClipboardPaste size={16} />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={clearSelectedFile} title="Clear selected file" className="p-1 h-auto">
                        <X size={16} />
                      </Button>
                    </div>
                  </div>
                  {isFileReading && <p className="text-xs text-muted-foreground mt-1">Reading file...</p>}
                </div>
              )}
              <div className="flex w-full gap-2">
                <Textarea 
                  placeholder="Type your message..." 
                  value={currentMessage}
                  onChange={(e) => setCurrentMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())}
                  className="flex-grow resize-none"
                  rows={1}
                />
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  style={{ display: 'none' }} 
                  accept=".txt,.md" 
                />
                <Button onClick={handleFileUploadClick} variant="outline" size="icon" title="Attach text file (.txt, .md)">
                  <Paperclip size={18}/>
                </Button>
                <Button onClick={handleSendMessage} disabled={!currentMessage.trim()} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                  <Send size={18}/>
                </Button>
              </div>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* Chat Summary Dialog */}
      <AlertDialog open={showSummaryDialog} onOpenChange={setShowSummaryDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><Sparkles className="text-accent"/>Chat Summary</AlertDialogTitle>
            <AlertDialogDescription>
              {isLoadingSummary ? "Generating summary..." : (summary || "No summary available.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowSummaryDialog(false)}>Close</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Whiteboard Dialog */}
      <Dialog open={isWhiteboardOpen} onOpenChange={setIsWhiteboardOpen}>
        <DialogContent className="sm:max-w-2xl md:max-w-4xl lg:max-w-6xl xl:max-w-[80vw] h-[85vh] p-0 flex flex-col">
          <DialogHeader className="p-4 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2"><Brush className="text-primary"/> Whiteboard</DialogTitle>
          </DialogHeader>
          <div className="flex-grow p-0 m-0 relative"> {/* Ensure this container fills space */}
            <Whiteboard />
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
