
import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  onAuthStateChanged, 
  signOut, 
  User 
} from "firebase/auth";
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  updateDoc, 
  doc, 
  getDoc, 
  serverTimestamp,
  setDoc
} from "firebase/firestore";
import { auth, db } from './firebase';
import { 
  Menu, X, Wand2, Layout, CheckCircle, 
  LogOut, Rocket, Globe, Save, Loader2,
  ChevronRight, Star, Shield, Zap, Mail, ArrowRight,
  Copy, Check, Code, Smartphone, Eye, Terminal, Lock
} from 'lucide-react';

// --- Types ---

interface SiteData {
  id?: string;
  userId: string;
  title: string;
  prompt: string;
  content: GeneratedSiteContent;
  isPublished: boolean;
  createdAt: any;
}

interface GeneratedSiteContent {
  title: string;
  description: string;
  slug: string;
  html: string;
  css: string;
  tailwind: boolean;
  assets: { path: string; alt: string }[];
  scripts: string;
  previewInstructions: string;
  seo: {
    titleTag: string;
    metaDescription: string;
    ogTitle: string;
    ogDescription: string;
    ogImage: string;
  };
  accessibilityNotes: string;
  mobileFirst: boolean;
  notes: string;
}

// --- Constants ---

const PRO_PROMPTS = [
  {
    label: "SaaS Product Launch",
    text: "Create a modern high-converting SaaS landing page for a project management tool called 'TaskFlow'. Sections: Hero with dashboard mockup, Features grid with icons, Social Proof with client logos, Pricing (Free, Pro, Enterprise), FAQ, and a clear CTA to Start Free Trial. Style: Clean, Minimalist, Blue and White palette."
  },
  {
    label: "Mobile App Showcase",
    text: "Create a vibrant mobile app landing page for a fitness tracking application called 'FitTrack'. Sections: Hero with app screenshot, 'How it works' 3-step process, User Testimonials, and Download buttons for App Store and Play Store. Style: Dark mode, neon accents, energetic."
  },
  {
    label: "E-Book / Lead Magnet",
    text: "Create a lead generation landing page for a free E-book titled 'The Ultimate Guide to AI Marketing'. Sections: Hero with book cover 3D mockup, 'What you'll learn' bullet points, Author bio, and a prominent Email Capture form. Style: Professional, trustworthy, serif fonts."
  },
  {
    label: "Agency Portfolio",
    text: "Create a creative portfolio landing page for a digital design agency. Sections: Hero with big bold typography, Selected Work grid (placeholders), Services list, Team section, and Contact form. Style: Artistic, bold, plenty of whitespace."
  },
  {
    label: "Waitlist Page",
    text: "Create a viral waitlist landing page for a stealth startup. Sections: Mysterious Hero with countdown timer placeholder, 'Why join?' value props, and a viral referral gamification explanation. Style: Futuristic, gradient background."
  },
  {
    label: "Coffee Shop Local Business",
    text: "Create a cozy, warm landing page for an artisanal coffee shop. Sections: Hero with cafe ambience image, Menu highlights, Location/Hours, and 'Order Online' CTA. Style: Earthy tones, browns and creams, inviting."
  }
];

// --- Gemini AI Setup ---
const ai = new GoogleGenAI({ apiKey: "AIzaSyAWE6sCwZZZP3V-K-gHIeqNQh_z6uuk6eE" });

// --- Components ---

const Button = ({ children, onClick, variant = 'primary', className = '', disabled = false }: any) => {
  const baseStyle = "px-6 py-3 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2";
  const variants = {
    primary: "bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl",
    secondary: "bg-white text-gray-900 border border-gray-200 hover:bg-gray-50 shadow-sm",
    outline: "border-2 border-white text-white hover:bg-white/10",
    ghost: "text-gray-600 hover:text-gray-900 hover:bg-gray-100",
    danger: "bg-red-500 text-white hover:bg-red-600"
  };
  return (
    <button 
      onClick={onClick} 
      disabled={disabled}
      className={`${baseStyle} ${variants[variant as keyof typeof variants]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    >
      {children}
    </button>
  );
};

// --- Preview Renderer (The Generated Site) ---

const GeneratedSiteRenderer = ({ content }: { content: GeneratedSiteContent }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (iframeRef.current && content) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(`
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${content.title}</title>
            <meta name="description" content="${content.description}">
            ${content.tailwind ? '<script src="https://cdn.tailwindcss.com"></script>' : ''}
            <style>
              /* Base Resets */
              body { margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; }
              ${content.css || ''}
            </style>
          </head>
          <body>
            ${content.html}
            <script>${content.scripts || ''}</script>
          </body>
          </html>
        `);
        doc.close();
      }
    }
  }, [content]);

  if (!content) return null;

  return (
    <iframe 
      ref={iframeRef} 
      className="w-full h-full border-0 bg-white shadow-inner"
      title="Site Preview"
      sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
    />
  );
};


// --- Auth Pages ---

const Auth = ({ type, onSuccess, onToggle }: { type: 'signin' | 'signup', onSuccess: () => void, onToggle: () => void }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (type === 'signup') {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        // Create user document in Firestore "users" collection with DEFAULT 'user' role
        await setDoc(doc(db, "users", userCredential.user.uid), {
          uid: userCredential.user.uid,
          email: userCredential.user.email,
          createdAt: serverTimestamp(),
          role: 'user' // Default role
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      onSuccess();
    } catch (err: any) {
      console.error(err);
      setError(err.message.replace('Firebase: ', ''));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-10">
        <div className="text-center mb-8">
           <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-100 text-blue-600 mb-4">
             <Zap size={24} />
           </div>
           <h2 className="text-3xl font-bold text-gray-900">
             {type === 'signin' ? 'Welcome Back' : 'Create Account'}
           </h2>
           <p className="text-gray-500 mt-2">
             {type === 'signin' ? 'Enter your details to access your dashboard' : 'Start building your landing pages today'}
           </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100 flex items-center gap-2">
            <Shield size={16} /> {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
            <input 
              type="email" 
              required
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
            <input 
              type="password" 
              required
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button 
            className="w-full"
            disabled={loading}
          >
            {loading ? <Loader2 className="animate-spin" /> : (type === 'signin' ? 'Sign In' : 'Sign Up')}
          </Button>
        </form>

        <div className="mt-8 text-center text-sm text-gray-600">
          {type === 'signin' ? "Don't have an account? " : "Already have an account? "}
          <button onClick={onToggle} className="text-blue-600 font-semibold hover:underline">
            {type === 'signin' ? 'Sign Up' : 'Sign In'}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Dashboard / Tool ---

const Dashboard = ({ user, userRole }: { user: User, userRole: string }) => {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentSite, setCurrentSite] = useState<SiteData | null>(null);
  const [sites, setSites] = useState<SiteData[]>([]);
  const [view, setView] = useState<'editor' | 'list'>('list');
  const [copied, setCopied] = useState(false);
  const [showDevTools, setShowDevTools] = useState(false);

  useEffect(() => {
    fetchSites();
  }, [user]);

  const fetchSites = async () => {
    try {
      // Fetch from users/{uid}/sites subcollection
      const sitesRef = collection(db, "users", user.uid, "sites");
      const querySnapshot = await getDocs(sitesRef);
      const userSites: SiteData[] = [];
      
      querySnapshot.forEach((doc) => {
        userSites.push({ id: doc.id, ...doc.data() } as SiteData);
      });

      // Sort client-side by createdAt
      userSites.sort((a, b) => {
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      });

      setSites(userSites);
    } catch (e: any) {
      console.error("Error fetching sites:", e);
      if (e.code === 'permission-denied') {
        alert("Database Permission Error: Please update your Firestore Rules to allow access to users/{uid}/sites.");
      }
    }
  };

  const generateSite = async () => {
    if (!prompt.trim()) return;
    setLoading(true);

    try {
      const schema: Schema = {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          slug: { type: Type.STRING },
          html: { type: Type.STRING },
          css: { type: Type.STRING },
          tailwind: { type: Type.BOOLEAN },
          assets: { 
            type: Type.ARRAY, 
            items: { 
              type: Type.OBJECT, 
              properties: { path: { type: Type.STRING }, alt: { type: Type.STRING } } 
            } 
          },
          scripts: { type: Type.STRING },
          previewInstructions: { type: Type.STRING },
          seo: { 
            type: Type.OBJECT, 
            properties: { 
              titleTag: { type: Type.STRING }, 
              metaDescription: { type: Type.STRING },
              ogTitle: { type: Type.STRING },
              ogDescription: { type: Type.STRING },
              ogImage: { type: Type.STRING }
            } 
          },
          accessibilityNotes: { type: Type.STRING },
          mobileFirst: { type: Type.BOOLEAN },
          notes: { type: Type.STRING }
        },
        required: ["title", "slug", "html", "css", "tailwind"]
      };

      const systemInstruction = `
        You are an expert web developer and UI designer. 
        Generate a COMPLETE, production-ready landing page that meets these platform requirements.
        Output as a single JSON object.
        
        Requirements:
        1. Visual & structural:
           - Modern, professional layout (Header, Hero, Features, How it Works, Pricing, Testimonials, About, Contact, CTA, Footer).
           - Clear CTA for Sign Up/Login.
           - Professional color scheme.
        2. Technical:
           - HTML must be valid, well-structured (semantic tags).
           - Mobile-first responsive layout.
           - If using Tailwind, set "tailwind": true.
           - Avoid external CDN dependencies (except Tailwind). 
           - Images should be placeholders (paths under /assets/).
           - Minimize JS.
        3. A11y & SEO:
           - Meaningful alt text.
           - Accessible contrast.
           - Aria labels.
        
        Return STRICT valid JSON.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Create landing page for: "${prompt}"`,
        config: {
          systemInstruction: systemInstruction,
          responseMimeType: "application/json",
          responseSchema: schema
        }
      });

      const content = JSON.parse(response.text || "{}");
      
      const newSite: SiteData = {
        userId: user.uid,
        title: content.title || prompt.slice(0, 30),
        prompt: prompt,
        content: content,
        isPublished: false,
        createdAt: serverTimestamp()
      };

      // Add to users/{uid}/sites subcollection
      const docRef = await addDoc(collection(db, "users", user.uid, "sites"), newSite);
      
      const savedSite = { ...newSite, id: docRef.id };
      setCurrentSite(savedSite);
      // Add to beginning of list
      setSites([savedSite, ...sites]);
      setView('editor');
    } catch (e) {
      console.error(e);
      alert("Failed to generate site. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const publishSite = async () => {
    if (!currentSite || !currentSite.id) return;
    const siteId = currentSite.id;
    try {
      // Update in users/{uid}/sites subcollection
      await updateDoc(doc(db, "users", user.uid, "sites", siteId), {
        isPublished: true
      });
      const updatedSite = { ...currentSite, isPublished: true };
      setCurrentSite(updatedSite);
      setSites(sites.map(s => s.id === siteId ? updatedSite : s));
    } catch (e) {
      console.error("Error publishing:", e);
      alert("There was an error publishing your site. Check console for details.");
    }
  };

  const copyLink = () => {
    if(!currentSite?.id) return;
    // New URL structure: #p/{userId}/{siteId}
    const url = `${window.location.origin}#p/${user.uid}/${currentSite.id}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      {/* Dev Tools Modal - Admin Only */}
      {showDevTools && userRole === 'admin' && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
             <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <div className="flex items-center gap-2">
                   <div className="bg-purple-100 p-2 rounded-lg text-purple-600">
                     <Terminal size={20} />
                   </div>
                   <div>
                     <h3 className="font-bold text-gray-900">Developer Console</h3>
                     <p className="text-xs text-gray-500">Admin Privileges Active</p>
                   </div>
                </div>
                <button onClick={() => setShowDevTools(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-700 transition-colors"><X size={20}/></button>
             </div>
             <div className="p-6 overflow-y-auto bg-gray-50/30">
                <div className="mb-4 flex items-center gap-2 text-sm text-purple-800 bg-purple-50 p-3 rounded-lg border border-purple-100">
                   <Lock size={16} className="shrink-0" />
                   <span>Admin-Only Prompt Templates. These are hidden from standard users.</span>
                </div>
                <div className="grid grid-cols-1 gap-3">
                   {PRO_PROMPTS.map((p, i) => (
                      <button 
                        key={i} 
                        onClick={() => { 
                          setPrompt(p.text); 
                          setView('editor'); 
                          setCurrentSite(null); 
                          setShowDevTools(false); 
                        }} 
                        className="group flex flex-col text-left p-4 bg-white border border-gray-200 rounded-xl hover:border-purple-500 hover:ring-1 hover:ring-purple-500 hover:shadow-md transition-all"
                      >
                         <div className="flex items-center justify-between mb-1">
                           <span className="font-bold text-gray-800 group-hover:text-purple-600 transition-colors">{p.label}</span>
                           <ArrowRight size={16} className="text-gray-300 group-hover:text-purple-500 opacity-0 group-hover:opacity-100 transition-all transform group-hover:translate-x-1" />
                         </div>
                         <div className="text-xs text-gray-500 leading-relaxed line-clamp-2">{p.text}</div>
                      </button>
                   ))}
                </div>
             </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <aside className="w-72 bg-white border-r border-gray-200 flex flex-col z-20 shadow-sm">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-2 font-bold text-2xl text-blue-600">
            <Zap size={28} className="fill-current" />
            <span>LaunchAI</span>
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <button 
            onClick={() => setView('list')}
            className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${view === 'list' ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <Layout size={20} />
            My Sites
          </button>
          <button 
            onClick={() => { setView('editor'); setCurrentSite(null); setPrompt(''); }}
            className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${view === 'editor' && !currentSite ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            <Wand2 size={20} />
            Create New
          </button>
          
          {/* Developer Mode Button - Admin Only */}
          {userRole === 'admin' && (
            <div className="pt-2 mt-2 border-t border-gray-100">
               <button 
                 onClick={() => setShowDevTools(true)}
                 className="w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-colors text-gray-600 hover:bg-gray-900 hover:text-white group"
               >
                 <div className="p-1 rounded bg-gray-100 group-hover:bg-gray-700 transition-colors">
                   <Terminal size={16} />
                 </div>
                 <span className="font-medium text-sm">Developer Mode</span>
               </button>
            </div>
          )}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center gap-3 mb-4 px-2">
             <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                {user.email?.charAt(0).toUpperCase()}
             </div>
             <div className="flex-1 overflow-hidden">
                <div className="text-sm text-gray-700 truncate font-medium">{user.email}</div>
                <div className="text-xs text-gray-400 capitalize">{userRole} Account</div>
             </div>
          </div>
          <button 
            onClick={() => signOut(auth)}
            className="w-full px-4 py-2 rounded-lg text-red-600 hover:bg-red-50 flex items-center gap-3 text-sm font-medium transition-colors"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {view === 'list' ? (
          <div className="p-8 overflow-y-auto h-full bg-gray-50">
            <header className="mb-8 flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Your Landing Pages</h1>
                <p className="text-gray-500 mt-1">Manage and publish your AI-generated sites</p>
              </div>
              <Button onClick={() => { setView('editor'); setCurrentSite(null); setPrompt(''); }}>
                <Wand2 size={18} /> New Project
              </Button>
            </header>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sites.map(site => (
                <div key={site.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-lg transition-all flex flex-col h-[320px] group">
                  <div className="h-40 bg-gray-100 flex items-center justify-center border-b border-gray-100 relative overflow-hidden">
                    {/* Mockup Preview */}
                    <div className="absolute inset-0 bg-gray-100 flex flex-col items-center justify-center text-gray-400">
                      <Layout size={40} className="mb-2 opacity-50"/>
                      <span className="text-xs uppercase font-bold tracking-wider opacity-50">Preview</span>
                    </div>
                    {site.isPublished && (
                      <span className="absolute top-3 right-3 bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-sm z-10">
                        <Globe size={12} /> Live
                      </span>
                    )}
                  </div>
                  <div className="p-6 flex-1 flex flex-col">
                    <h3 className="font-bold text-lg text-gray-900 mb-1 truncate" title={site.title}>{site.title}</h3>
                    <div className="text-sm text-gray-500 mb-6 flex-1 line-clamp-2">
                       {site.content.description || "AI Generated Landing Page"}
                    </div>
                    <div className="flex gap-3">
                      <button 
                        onClick={() => { setCurrentSite(site); setView('editor'); }}
                        className="flex-1 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 hover:border-gray-300 transition-all"
                      >
                        Edit
                      </button>
                      {site.isPublished && (
                         <a 
                           href={`#p/${site.userId}/${site.id}`}
                           target="_blank"
                           rel="noreferrer"
                           className="flex-1 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 text-center transition-all"
                         >
                           View
                         </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {sites.length === 0 && (
                <div className="col-span-full py-12 text-center text-gray-500">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Wand2 size={24} className="text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-1">No sites yet</h3>
                  <p className="mb-4">Create your first landing page to get started.</p>
                  <Button onClick={() => { setView('editor'); setCurrentSite(null); setPrompt(''); }} variant="secondary">
                    Create New Site
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : (
          // Editor View
          <div className="flex h-full">
            {/* Editor Controls */}
            <div className="w-[400px] bg-white border-r border-gray-200 flex flex-col shadow-lg z-10">
              <div className="p-6 border-b border-gray-100">
                <button onClick={() => setView('list')} className="text-gray-500 hover:text-gray-800 text-sm flex items-center gap-1 mb-6 transition-colors">
                  <ChevronRight size={16} className="rotate-180" /> Back to Dashboard
                </button>
                <div className="flex justify-between items-center mb-2">
                  <h2 className="text-2xl font-bold">AI Generator</h2>
                  {/* Pro Prompts Button - Admin Only */}
                  {userRole === 'admin' && (
                    <button onClick={() => setShowDevTools(true)} className="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded hover:bg-purple-100 flex items-center gap-1">
                      <Terminal size={12}/> Admin Tools
                    </button>
                  )}
                </div>
                <p className="text-sm text-gray-500 leading-relaxed">
                  Describe your product, service, or idea. The AI will generate a complete landing page structure for you.
                </p>
              </div>

              <div className="p-6 flex-1 overflow-y-auto">
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-900 mb-3">Your Prompt</label>
                  <textarea 
                    className="w-full h-48 p-4 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none bg-gray-50 text-gray-700 text-sm leading-relaxed"
                    placeholder="E.g. A subscription service for organic coffee beans delivered weekly. The target audience is coffee enthusiasts who care about sustainability..."
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    disabled={loading || (!!currentSite && !!currentSite.id)}
                  />
                  <div className="flex justify-end mt-2 text-xs text-gray-400">
                    {prompt.length} chars
                  </div>
                </div>
                
                {!currentSite ? (
                  <Button onClick={generateSite} disabled={loading || !prompt.trim()} className="w-full shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all">
                    {loading ? <><Loader2 className="animate-spin" /> Generating Magic...</> : <><Wand2 size={18} /> Generate Site</>}
                  </Button>
                ) : (
                  <div className="space-y-6 animate-fade-in">
                     <div className="p-4 bg-green-50 text-green-800 rounded-xl border border-green-100 flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-green-200 flex items-center justify-center shrink-0">
                           <Check size={14} className="text-green-700" />
                        </div>
                        <div>
                          <strong className="block mb-1">Generation Complete!</strong>
                          <p className="text-sm opacity-90">Your site is ready. Review the preview on the right.</p>
                        </div>
                     </div>

                     <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                       <h3 className="font-bold text-gray-900 mb-2">Site Details</h3>
                       <div className="space-y-2 text-sm text-gray-600">
                         <div className="flex justify-between">
                           <span>Title</span>
                           <span className="font-medium text-gray-900 truncate max-w-[150px]">{currentSite.content.title}</span>
                         </div>
                         <div className="flex justify-between">
                           <span>Framework</span>
                           <span className="font-medium text-gray-900">{currentSite.content.tailwind ? 'Tailwind CSS' : 'Custom CSS'}</span>
                         </div>
                         <div className="flex justify-between">
                           <span>Mobile First</span>
                           <span className="font-medium text-gray-900">{currentSite.content.mobileFirst ? 'Yes' : 'No'}</span>
                         </div>
                       </div>
                     </div>
                     
                     {currentSite.isPublished ? (
                       <div className="space-y-3">
                         <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                           <div className="text-xs font-bold text-blue-600 uppercase mb-2">Public URL</div>
                           <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-blue-200 text-sm text-gray-600 shadow-sm">
                             <Globe size={14} className="text-blue-400" />
                             <span className="truncate flex-1">{window.location.origin}#p/{user.uid}/{currentSite.id}</span>
                             <button onClick={copyLink} className="p-1.5 hover:bg-gray-100 rounded text-gray-500 transition-colors">
                               {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                             </button>
                           </div>
                         </div>
                         <Button onClick={() => window.open(`#p/${user.uid}/${currentSite.id}`, '_blank')} variant="outline" className="w-full !border-gray-200 !text-gray-700 hover:!bg-gray-50 hover:!text-blue-600">
                           Open Live Site <ArrowRight size={16} />
                         </Button>
                       </div>
                     ) : (
                       <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                         <div className="text-sm text-gray-600 mb-4">
                           Ready to go live? Publishing makes your site accessible to anyone with the link.
                         </div>
                         <Button onClick={publishSite} className="w-full bg-green-600 hover:bg-green-700 text-white shadow-lg hover:shadow-green-500/30">
                           <Rocket size={18} /> Publish to Web
                         </Button>
                       </div>
                     )}
                     
                     <div className="pt-6 border-t border-gray-100">
                        <Button onClick={() => { setCurrentSite(null); setPrompt(''); }} variant="ghost" className="w-full text-gray-500 hover:text-red-600 hover:bg-red-50">
                            Delete & Start Over
                        </Button>
                     </div>
                  </div>
                )}
              </div>
            </div>

            {/* Live Preview Area */}
            <div className="flex-1 bg-gray-100 relative overflow-hidden flex flex-col">
               <div className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 shadow-sm z-10">
                 <div className="flex items-center gap-4">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-400"></div>
                      <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                      <div className="w-3 h-3 rounded-full bg-green-400"></div>
                    </div>
                    <div className="h-8 bg-gray-100 rounded-md text-xs flex items-center px-3 text-gray-400 w-64 border border-gray-200 font-mono">
                      {currentSite ? `${window.location.host}/p/${user.uid.slice(0,5)}/${currentSite.content.slug || 'preview'}` : 'waiting...'}
                    </div>
                 </div>
                 <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-gray-400 text-xs font-medium">
                        <div className="flex items-center gap-1 cursor-not-allowed"><Eye size={14}/> Desktop</div>
                        <div className="w-px h-4 bg-gray-200"></div>
                        <div className="flex items-center gap-1 cursor-not-allowed"><Smartphone size={14}/> Mobile</div>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-bold text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                        Live Preview
                    </div>
                 </div>
               </div>

               <div className="flex-1 overflow-hidden relative bg-white">
                  {loading ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 bg-gray-50/50 backdrop-blur-sm z-50">
                      <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-6"></div>
                      <p className="text-lg font-medium animate-pulse text-gray-800">Generating Landing Page...</p>
                      <p className="text-sm opacity-60 mt-2">Writing HTML, CSS & Copy</p>
                    </div>
                  ) : currentSite ? (
                    <GeneratedSiteRenderer content={currentSite.content} />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 bg-gray-50">
                      <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-sm mb-6">
                        <Code size={40} className="text-gray-300" />
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 mb-2">Ready to Build</h3>
                      <p className="max-w-md text-center">Enter a prompt in the sidebar to generate your first landing page.</p>
                      {userRole === 'admin' && (
                        <button onClick={() => setShowDevTools(true)} className="mt-4 text-purple-600 text-sm hover:underline flex items-center gap-1">
                            <Terminal size={14} /> Open Admin Console
                        </button>
                      )}
                    </div>
                  )}
               </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

// --- Main Marketing Home Page ---

const LandingPage = ({ onGetStarted, onSignIn }: { onGetStarted: () => void, onSignIn: () => void }) => {
  return (
    <div className="font-sans text-gray-900 bg-white selection:bg-blue-100 selection:text-blue-900">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 bg-white/90 backdrop-blur-md z-50 border-b border-gray-100 shadow-sm transition-all">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-2xl text-blue-600 tracking-tight">
            <Zap size={28} className="fill-current" />
            LaunchAI
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600">
            <a href="#features" className="hover:text-blue-600 transition-colors">Features</a>
            <a href="#testimonials" className="hover:text-blue-600 transition-colors">Testimonials</a>
            <a href="#pricing" className="hover:text-blue-600 transition-colors">Pricing</a>
            <a href="#about" className="hover:text-blue-600 transition-colors">About</a>
          </nav>
          <div className="flex items-center gap-4">
            <button onClick={onSignIn} className="text-sm font-semibold text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors">
              Sign In
            </button>
            <Button onClick={onGetStarted} className="!px-6 !py-2.5 rounded-full shadow-lg hover:shadow-blue-500/20">
              Get Started
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-24 px-6 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-blue-50 rounded-full blur-3xl -z-10 opacity-60"></div>
        <div className="max-w-7xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 text-blue-700 text-sm font-bold mb-8 border border-blue-100 shadow-sm animate-fade-in-up">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
            New: Gemini 2.5 Integration
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold text-gray-900 tracking-tight mb-8 leading-tight">
            Generate High-Converting <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Landing Pages Instantly</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-12 leading-relaxed">
            Turn your ideas into published websites in seconds using advanced AI. No coding, no design skills, just results.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20">
            <Button onClick={onGetStarted} className="!text-lg !px-8 !py-4 rounded-full shadow-xl hover:shadow-2xl hover:scale-105 transition-all">
              Build My Site for Free <ArrowRight size={20} />
            </Button>
            <Button variant="secondary" className="!text-lg !px-8 !py-4 rounded-full bg-white shadow-md hover:shadow-lg">
              View Showcase
            </Button>
          </div>
          
          <div className="relative max-w-5xl mx-auto rounded-xl shadow-2xl border-4 border-gray-900/5 bg-gray-900 overflow-hidden group">
            <div className="absolute top-0 left-0 right-0 h-10 bg-gray-800 flex items-center px-4 gap-2">
               <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
               </div>
            </div>
            <img 
              src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?ixlib=rb-4.0.3&auto=format&fit=crop&w=2426&q=80" 
              alt="Dashboard Preview" 
              className="w-full h-auto mt-10 opacity-90 group-hover:opacity-100 transition-opacity"
            />
          </div>
        </div>
      </section>

      {/* Info/Features */}
      <section id="features" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-4xl font-bold mb-4 tracking-tight">Everything you need to launch</h2>
            <p className="text-gray-600 text-lg max-w-2xl mx-auto">We handle the heavy lifting of design, copy, and hosting so you can focus on your business.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-12">
            {[
              { icon: <Wand2 size={32} />, title: "AI-Powered Design", desc: "Just type a prompt. Our advanced Gemini model writes persuasive copy, selects the perfect layout, and applies industry-appropriate themes." },
              { icon: <Globe size={32} />, title: "Instant Hosting", desc: "Publish your site with one click. We provide a secure, fast, and globally distributed URL for your campaign immediately." },
              { icon: <Shield size={32} />, title: "Secure & Scalable", desc: "Built on Google's global infrastructure (Firebase) for maximum reliability, speed, and security." }
            ].map((f, i) => (
              <div key={i} className="bg-gray-50 p-8 rounded-3xl hover:bg-white hover:shadow-xl transition-all duration-300 border border-transparent hover:border-gray-100 group">
                <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  {f.icon}
                </div>
                <h3 className="text-xl font-bold mb-3">{f.title}</h3>
                <p className="text-gray-600 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-24 bg-blue-600 text-white">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-4xl font-bold text-center mb-16 tracking-tight">Loved by Founders</h2>
          <div className="grid md:grid-cols-2 gap-8">
            {[
              { q: "I built my SaaS waiting list page in 30 seconds. It collected 500 emails in a week! The AI copy was surprisingly on point.", u: "Sarah Jenkins", r: "Indie Hacker" },
              { q: "The easiest way to validate an idea. I used to spend days on landing pages, now I spend minutes. Highly recommended.", u: "Mike Thompson", r: "Product Manager" }
            ].map((t, i) => (
              <div key={i} className="p-10 bg-blue-700/50 backdrop-blur-sm rounded-3xl border border-blue-500/30">
                <div className="flex gap-1 text-yellow-400 mb-6">
                  {[1,2,3,4,5].map(s => <Star key={s} size={20} fill="currentColor" />)}
                </div>
                <p className="text-2xl font-medium mb-8 leading-relaxed">"{t.q}"</p>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center font-bold text-lg">
                    {t.u.charAt(0)}
                  </div>
                  <div>
                    <div className="font-bold text-lg">{t.u}</div>
                    <div className="text-blue-200">{t.r}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-4xl font-bold text-center mb-16 tracking-tight">Simple, Transparent Pricing</h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto items-center">
            {[
              { n: "Starter", p: "$0", f: ["1 Active Project", "Basic AI Model", "Community Support", "LaunchAI Branding"] },
              { n: "Pro", p: "$29", f: ["Unlimited Projects", "Premium AI Model", "Custom Domains", "Priority Support", "No Branding"], active: true },
              { n: "Business", p: "$99", f: ["Team Access", "API Access", "White Labeling", "Dedicated Account Manager"] }
            ].map((plan, i) => (
              <div key={i} className={`p-8 rounded-3xl transition-all ${plan.active ? 'bg-white border-2 border-blue-600 shadow-2xl scale-105 z-10' : 'bg-white border border-gray-200 hover:shadow-lg'}`}>
                <h3 className="text-2xl font-bold mb-2">{plan.n}</h3>
                <div className="text-4xl font-bold mb-6">{plan.p}<span className="text-lg font-normal text-gray-500">/mo</span></div>
                <ul className="space-y-4 mb-8">
                  {plan.f.map((feat, k) => (
                    <li key={k} className="flex items-center gap-3 text-gray-700">
                      <CheckCircle size={20} className={plan.active ? 'text-blue-600' : 'text-gray-400'} />
                      {feat}
                    </li>
                  ))}
                </ul>
                <Button variant={plan.active ? 'primary' : 'secondary'} className="w-full">
                  Choose {plan.n}
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="py-24 bg-white">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold mb-8 tracking-tight">About LaunchAI</h2>
          <p className="text-xl text-gray-600 mb-12 leading-relaxed">
            We are a team of developers and designers passionate about removing the friction from launching new ideas. 
            We believe that everyone should be able to test their market fit without spending weeks on web development or hiring expensive agencies.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
             {[
               { l: "10k+", d: "Sites Created" },
               { l: "99.9%", d: "Uptime" },
               { l: "24/7", d: "Support" },
               { l: "4.9/5", d: "User Rating" }
             ].map((s, i) => (
               <div key={i} className="p-6 bg-gray-50 rounded-2xl">
                 <div className="text-3xl font-bold text-blue-600 mb-1">{s.l}</div>
                 <div className="text-sm text-gray-500 uppercase tracking-wide font-bold">{s.d}</div>
               </div>
             ))}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="py-24 bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-16 items-center">
          <div>
             <h2 className="text-4xl font-bold mb-6">Get in Touch</h2>
             <p className="text-lg text-gray-400 mb-8 leading-relaxed">
               Have questions? We'd love to hear from you. Send us a message and we'll respond as soon as possible.
             </p>
             <div className="space-y-6">
               <div className="flex items-center gap-4 text-gray-300">
                 <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center text-blue-400">
                   <Mail size={24} />
                 </div>
                 <span className="text-lg">support@launchai.com</span>
               </div>
               <div className="flex items-center gap-4 text-gray-300">
                  <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center text-blue-400">
                    <Globe size={24} />
                  </div>
                 <span className="text-lg">www.launchai.com</span>
               </div>
             </div>
          </div>
          <form className="space-y-4 bg-white p-8 rounded-3xl text-gray-900 shadow-2xl">
            <h3 className="text-2xl font-bold mb-2">Send Message</h3>
            <div className="grid grid-cols-2 gap-4">
              <input type="text" placeholder="First Name" className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-blue-500" />
              <input type="text" placeholder="Last Name" className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <input type="email" placeholder="Email Address" className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-blue-500" />
            <textarea placeholder="Message" rows={4} className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-blue-500"></textarea>
            <Button className="w-full py-4 text-lg">Send Message</Button>
          </form>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-950 text-white py-12 px-6 border-t border-gray-900">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 font-bold text-xl">
            <Zap size={24} /> LaunchAI
          </div>
          <div className="flex gap-8 text-sm text-gray-400">
            <a href="#" className="hover:text-white">Privacy Policy</a>
            <a href="#" className="hover:text-white">Terms of Service</a>
            <a href="#" className="hover:text-white">Cookies</a>
          </div>
          <div className="text-gray-500 text-sm">
            © 2024 LaunchAI Inc.
          </div>
        </div>
      </footer>
    </div>
  );
};

// --- App Container / Router ---

const App = () => {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string>('user');
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'landing' | 'auth' | 'dashboard' | 'public_site'>('landing');
  const [authType, setAuthType] = useState<'signin' | 'signup'>('signin');
  const [publicSiteData, setPublicSiteData] = useState<GeneratedSiteContent | null>(null);

  useEffect(() => {
    // Hash Routing Logic for Public Sites
    const checkHash = async () => {
      const hash = window.location.hash;
      // New format: #p/{userId}/{siteId}
      if (hash.startsWith('#p/')) {
        const parts = hash.replace('#p/', '').split('/');
        if (parts.length >= 2) {
           const userId = parts[0];
           const siteId = parts[1];
           
           setLoading(true);
           try {
             // Look in the specific user's subcollection
             const docRef = doc(db, "users", userId, "sites", siteId);
             const docSnap = await getDoc(docRef);
             
             if (docSnap.exists()) {
                const data = docSnap.data() as SiteData;
                if (data.isPublished) {
                  setPublicSiteData(data.content);
                  setView('public_site');
                } else {
                  alert("This site is not yet published by the author.");
                  window.location.hash = '';
                  setView('landing');
                }
             } else {
                alert("Site not found. Check the URL and try again.");
                window.location.hash = '';
                setView('landing');
             }
           } catch (e) {
             console.error(e);
             setView('landing');
           } finally {
             setLoading(false);
           }
           return true;
        }
      }
      return false; 
    };

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        // Fetch user role from Firestore
        try {
          const userRef = doc(db, "users", currentUser.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const userData = userSnap.data();
            setUserRole(userData.role || 'user');
          }
        } catch (e) {
          console.error("Error fetching user role:", e);
        }
      }

      // Only navigate if we aren't viewing a public site
      if (!window.location.hash.startsWith('#p/')) {
        if (currentUser) {
          setView('dashboard');
        } else {
          if(view !== 'auth') setView('landing');
        }
      }
      setLoading(false);
    });

    checkHash();
    window.addEventListener('hashchange', checkHash);

    return () => {
      unsubscribe();
      window.removeEventListener('hashchange', checkHash);
    };
  }, [view]);

  if (loading) {
    return <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-gray-500">
      <Loader2 size={48} className="animate-spin text-blue-600 mb-4" />
      <p className="animate-pulse">Loading LaunchAI...</p>
    </div>;
  }

  // Public Site View
  if (view === 'public_site' && publicSiteData) {
    return (
        <div className="w-full h-screen">
            <GeneratedSiteRenderer content={publicSiteData} />
            <div className="fixed bottom-4 right-4 z-50">
               <a href="/" className="bg-black text-white px-4 py-2 rounded-full text-xs font-bold shadow-lg opacity-50 hover:opacity-100 transition-opacity flex items-center gap-2">
                 <Zap size={12} fill="currentColor"/> Built with LaunchAI
               </a>
            </div>
        </div>
    );
  }

  // Auth Views
  if (view === 'auth') {
    return <Auth 
      type={authType} 
      onSuccess={() => setView('dashboard')} 
      onToggle={() => setAuthType(authType === 'signin' ? 'signup' : 'signin')}
    />;
  }

  // Dashboard
  if (user && view === 'dashboard') {
    return <Dashboard user={user} userRole={userRole} />;
  }

  // Fallback / Landing
  return <LandingPage 
    onGetStarted={() => { setAuthType('signup'); setView('auth'); }} 
    onSignIn={() => { setAuthType('signin'); setView('auth'); }} 
  />;
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
