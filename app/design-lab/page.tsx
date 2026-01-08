export default function DesignLabPage() {
    return (
        <main className="w-screen h-screen overflow-auto bg-white relative">
            {/* Dot pattern background - matching canvas */}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{
                    backgroundImage: `radial-gradient(circle, #cbd5e1 1.5px, transparent 1.5px)`,
                    backgroundSize: '24px 24px',
                }}
            />

            {/* Content container */}
            <div className="relative z-10 p-10">
                <h1 className="text-2xl font-bold text-gray-800 mb-8">
                    🎨 Design Lab - Sidebar Experiments
                </h1>

                <div className="flex gap-12 items-start">
                    {/* ===================== SIDEBAR DESIGN ===================== */}
                    <div
                        className="w-[280px] h-[600px] rounded-2xl flex flex-col overflow-hidden"
                        style={{
                            backgroundColor: '#fafafa',
                            border: '1px solid rgba(0,0,0,0.06)',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
                        }}
                    >
                        {/* Header */}
                        <div className="px-4 py-4 border-b border-gray-100">
                            <div className="flex items-center justify-between">
                                {/* Logo */}
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
                                        <span className="text-white text-sm font-bold">S</span>
                                    </div>
                                    <span className="font-semibold text-gray-800">Spatial AI</span>
                                </div>
                                {/* New Workspace Button */}
                                <button
                                    className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
                                    title="New Workspace"
                                >
                                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {/* Workspace List */}
                        <div className="flex-1 overflow-y-auto px-3 py-3">
                            {/* Today Section */}
                            <div className="mb-4">
                                <p className="text-xs font-medium text-gray-400 px-2 mb-2 uppercase tracking-wider">Today</p>
                                {/* Active Workspace */}
                                <div className="px-3 py-2.5 rounded-xl bg-blue-50 border border-blue-100 cursor-pointer mb-1">
                                    <p className="text-sm font-medium text-blue-700 truncate">Project Table Design</p>
                                    <p className="text-xs text-blue-400 mt-0.5">12 nodes • Edited just now</p>
                                </div>
                                {/* Regular Item */}
                                <div className="px-3 py-2.5 rounded-xl hover:bg-gray-100 cursor-pointer transition-colors mb-1 group">
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm font-medium text-gray-700 truncate">Machine Learning Notes</p>
                                        <svg className="w-4 h-4 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                                        </svg>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-0.5">8 nodes • 2 hours ago</p>
                                </div>
                            </div>

                            {/* This Week Section */}
                            <div className="mb-4">
                                <p className="text-xs font-medium text-gray-400 px-2 mb-2 uppercase tracking-wider">This Week</p>
                                <div className="px-3 py-2.5 rounded-xl hover:bg-gray-100 cursor-pointer transition-colors mb-1 group">
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm font-medium text-gray-700 truncate">Brainstorm: App Ideas</p>
                                        <div className="flex items-center gap-1">
                                            <svg className="w-3.5 h-3.5 text-rose-400" fill="currentColor" viewBox="0 0 24 24">
                                                <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                            </svg>
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-0.5">15 nodes • Mon 3:42 PM</p>
                                </div>
                                <div className="px-3 py-2.5 rounded-xl hover:bg-gray-100 cursor-pointer transition-colors mb-1">
                                    <p className="text-sm font-medium text-gray-700 truncate">Psychology Chapter 1</p>
                                    <p className="text-xs text-gray-400 mt-0.5">6 nodes • Tue 10:15 AM</p>
                                </div>
                            </div>

                            {/* Older Section */}
                            <div className="mb-4">
                                <p className="text-xs font-medium text-gray-400 px-2 mb-2 uppercase tracking-wider">Older</p>
                                <div className="px-3 py-2.5 rounded-xl hover:bg-gray-100 cursor-pointer transition-colors mb-1">
                                    <p className="text-sm font-medium text-gray-700 truncate">Recipe Collection</p>
                                    <p className="text-xs text-gray-400 mt-0.5">23 nodes • Dec 28</p>
                                </div>
                                <div className="px-3 py-2.5 rounded-xl hover:bg-gray-100 cursor-pointer transition-colors mb-1">
                                    <p className="text-sm font-medium text-gray-700 truncate">Travel Planning 2025</p>
                                    <p className="text-xs text-gray-400 mt-0.5">11 nodes • Dec 20</p>
                                </div>
                                <div className="px-3 py-2.5 rounded-xl hover:bg-gray-100 cursor-pointer transition-colors mb-1">
                                    <p className="text-sm font-medium text-gray-700 truncate">Work Meeting Notes</p>
                                    <p className="text-xs text-gray-400 mt-0.5">4 nodes • Dec 15</p>
                                </div>
                            </div>
                        </div>

                        {/* Bottom Section - User Profile */}
                        <div className="border-t border-gray-100 px-3 py-3">
                            <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-gray-100 cursor-pointer transition-colors">
                                <div className="w-8 h-8 rounded-full bg-pink-400 flex items-center justify-center">
                                    <span className="text-white text-sm font-medium">Y</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-700 truncate">Yosia</p>
                                    <p className="text-xs text-gray-400">Free Plan</p>
                                </div>
                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    {/* ===================== EXISTING CARDS ===================== */}
                    <div className="flex flex-col gap-8">
                        <p className="text-sm text-gray-500 mb-2">Existing card designs for reference:</p>

                        {/* Pink Card */}
                        <div
                            className="relative w-[320px] rounded-[20px] flex flex-col gap-3 p-4"
                            style={{
                                backgroundColor: '#fce7f3',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                            }}
                        >
                            <div className="flex justify-between items-center px-1">
                                <h2 className="text-lg font-semibold" style={{ color: '#db2777' }}>
                                    Psychology
                                </h2>
                                <div className="flex items-center gap-2">
                                    <button className="text-gray-400 hover:text-gray-600">
                                        <span className="text-lg tracking-wider">•••</span>
                                    </button>
                                    <svg className="w-5 h-5 text-rose-500" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                    </svg>
                                </div>
                            </div>

                            <div
                                className="rounded-[16px] px-5 py-4"
                                style={{
                                    backgroundColor: '#ffffff',
                                    border: '1px solid rgba(0,0,0,0.03)',
                                }}
                            >
                                <div className="flex gap-2 mb-4">
                                    <span
                                        className="text-xs px-2.5 py-1 rounded-md font-medium"
                                        style={{
                                            backgroundColor: '#fce7f3',
                                            color: '#be185d',
                                            border: '1px solid #f9a8d4'
                                        }}
                                    >
                                        📚 Studies
                                    </span>
                                </div>

                                <div className="text-sm text-gray-600 leading-relaxed">
                                    <p>
                                        Psychology is the scientific study of behavior and mental processes...
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Green Card */}
                        <div
                            className="relative w-[320px] rounded-[20px] flex flex-col gap-3 p-4"
                            style={{
                                backgroundColor: '#dcfce7',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                            }}
                        >
                            <div className="flex justify-between items-center px-1">
                                <h2 className="text-lg font-semibold" style={{ color: '#16a34a' }}>
                                    Groceries
                                </h2>
                                <button className="text-gray-400 hover:text-gray-600">
                                    <span className="text-lg tracking-wider">•••</span>
                                </button>
                            </div>

                            <div className="rounded-[16px] px-5 py-4" style={{ backgroundColor: '#ffffff', border: '1px solid rgba(0,0,0,0.03)' }}>
                                <div className="flex gap-2 mb-4">
                                    <span className="text-xs px-2.5 py-1 rounded-md font-medium" style={{ backgroundColor: '#dcfce7', color: '#16a34a', border: '1px solid #86efac' }}>
                                        🍎 Food
                                    </span>
                                </div>

                                <ul className="text-sm text-gray-600 space-y-1">
                                    <li>Milk</li>
                                    <li>Chicken breast</li>
                                    <li>Apple Juice</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}

