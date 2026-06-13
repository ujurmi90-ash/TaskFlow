/**
 * FastBlog - Core Application Logic
 * Implements Multi-Brand Workspace Dashboards (Allies, Brandnook, CR),
 * Multi-Model AI Simulation, Compiler Editor, SEO Checklist,
 * Canvas Artwork Renderer, MS Word .doc Exporter, and Review Flow.
 */

class FastBlogApp {
    constructor() {
        this.state = {
            activeBrand: "allies", // allies, brandnook, cr
            blogs: {
                allies: [],
                brandnook: [],
                cr: []
            },
            activeBlogId: {
                allies: null,
                brandnook: null,
                cr: null
            },
            // The active blog details (mirrored here for easy referencing)
            blogId: null,
            blogTitle: "",
            keywords: "",
            compiledContent: "",
            generatedImage: null,
            imageAspect: "16-9",
            imagePrompt: "",
            workflowState: "draft",
            bossName: "Mr. CEO / Project Director",
            recentImages: [],
            currentStep: 1,

            // Global UI Configs
            currentTone: {
                chatgpt: "professional",
                claude: "professional",
                perplexity: "professional"
            },
            sidebarCollapsed: false,
            collapsedBoards: {
                chatgpt: false,
                claude: false,
                perplexity: false
            },
            apiSettings: {
                openai: "",
                anthropic: "",
                perplexity: ""
            },
            libraryFilter: "all"
        };

        this.dom = {};
    }

    init() {
        this.cacheDOM();
        this.bindEvents();
        this.loadAppState(); // Loads the entire brand workspaces model
        this.applyBrandUI();
    }

    cacheDOM() {
        this.dom.titleInput = document.getElementById("blog-title");
        this.dom.keywordsInput = document.getElementById("blog-keywords");
        this.dom.compilerInput = document.getElementById("compiler-input");
        this.dom.compilerTitleDisplay = document.getElementById("compiler-title-display");
        this.dom.libraryBlogList = document.getElementById("library-blog-list");
        
        // Brand Selector Buttons
        this.dom.tabAllies = document.getElementById("tab-allies");
        this.dom.tabBrandnook = document.getElementById("tab-brandnook");
        this.dom.tabCr = document.getElementById("tab-cr");

        this.dom.sidebar = document.getElementById("ai-sidebar");
        this.dom.expandSidebarBtn = document.getElementById("expand-sidebar-btn");
        this.dom.sidebarHeightToggle = document.getElementById("sidebar-height-toggle");
        this.dom.workspaceContainer = document.querySelector(".workspace-grid-container");

        // Metrics
        this.dom.wordCount = document.getElementById("val-wordcount");
        this.dom.readTime = document.getElementById("val-readtime");
        this.dom.seoScore = document.getElementById("val-seoscore");
        this.dom.seoBar = document.getElementById("val-seobar");
        this.dom.progressBadge = document.getElementById("writing-progress-badge");
        
        // Image Generator
        this.dom.imagePrompt = document.getElementById("image-prompt");
        this.dom.blogImageBox = document.getElementById("blog-image-box");
        this.dom.compiledBlogImage = document.getElementById("compiled-blog-image");
        this.dom.imageSpinner = document.getElementById("image-spinner");
        this.dom.mockGallery = document.getElementById("mock-gallery");
        this.dom.galleryGrid = document.getElementById("gallery-grid");

        // Workflow & Approval
        this.dom.statusDot = document.getElementById("status-dot");
        this.dom.statusText = document.getElementById("status-text");
        this.dom.timeline = document.getElementById("approval-timeline");
        this.dom.timelineEmpty = document.getElementById("timeline-empty");
        this.dom.btnShareBoss = document.getElementById("btn-share-boss");
        this.dom.exportActions = document.getElementById("export-actions");

        // Modals
        this.dom.shareModal = document.getElementById("share-modal");
        this.dom.settingsModal = document.getElementById("settings-modal");
        
        // Share preview
        this.dom.modalPreviewImg = document.getElementById("modal-preview-img");
        this.dom.modalPreviewTitle = document.getElementById("modal-preview-title");
        this.dom.modalPreviewMeta = document.getElementById("modal-preview-meta");
    }

    bindEvents() {
        // Dynamic input updates
        this.dom.titleInput.addEventListener("input", (e) => {
            this.state.blogTitle = e.target.value;
            this.updateSEOMetrics();
            this.saveActiveBlog();
        });
        
        this.dom.keywordsInput.addEventListener("input", (e) => {
            this.state.keywords = e.target.value;
            this.updateSEOMetrics();
            this.saveActiveBlog();
        });
    }

    /* MULTI-BRAND WORKSPACE CONTROLLER */
    switchBrand(brand) {
        // 1. Save current active blog first
        this.saveActiveBlog();

        // 2. Set new active brand
        this.state.activeBrand = brand;
        localStorage.setItem("fastblog_active_brand", brand);

        // 3. Update theme classes and tabs
        this.applyBrandUI();

        // 4. Load that brand's workspace contents
        this.loadBrandWorkspace();
    }

    applyBrandUI() {
        const brand = this.state.activeBrand;

        // Set body theme
        document.body.className = `theme-${brand}`;

        // Switch active tab classes
        const tabs = [this.dom.tabAllies, this.dom.tabBrandnook, this.dom.tabCr];
        tabs.forEach(tab => {
            if (tab) {
                if (tab.id === `tab-${brand}`) {
                    tab.classList.add("active");
                } else {
                    tab.classList.remove("active");
                }
            }
        });

        // Set compiler title display
        const brandNames = { allies: "Allies", brandnook: "Brandnook", cr: "CR" };
        if (this.dom.compilerTitleDisplay) {
            this.dom.compilerTitleDisplay.textContent = `${brandNames[brand]} Content Compiler`;
        }
    }

    loadBrandWorkspace() {
        const brand = this.state.activeBrand;
        
        // Get active blog ID for this brand
        let activeId = this.state.activeBlogId[brand];
        let blogList = this.state.blogs[brand];

        // If no blogs exist, initialize a default one
        if (blogList.length === 0) {
            this.createNewBlog(true); // create silent default
            return;
        }

        // If there's no active blog id or it doesn't match list, load the first one
        let activeBlog = blogList.find(b => b.id === activeId);
        if (!activeBlog) {
            activeBlog = blogList[0];
            this.state.activeBlogId[brand] = activeBlog.id;
        }

        // Set the active blog states
        this.loadBlogData(activeBlog);
        
        // Re-generate list items UI
        this.renderLibraryList();
    }

    createNewBlog(silent = false) {
        const brand = this.state.activeBrand;
        const newId = `blog_${Date.now()}`;

        // Create default contents matching the brand's niche
        let title = "";
        let keywords = "";
        let content = "";
        let prompt = "";

        if (brand === "allies") {
            title = "5 Commercial Real Estate Trends Shaping 2026";
            keywords = "commercial real estate, property investment";
            prompt = "A sleek, premium view of a glass-clad commercial skyscraper during sunset, reflecting corporate lights, photography.";
            content = `## The Commercial Investment Landscape\n\nAs we enter 2026, **commercial real estate** is adapting to new office architectures. Property investors are prioritizing hybrid layouts and ESG-compliant buildings. In this brief, we examine the structural indicators driving lease demands...\n\n`;
        } else if (brand === "brandnook") {
            title = "Maximizing Productivity: Why Coworking Spaces Boost Creative Output";
            keywords = "coworking spaces, creative productivity";
            prompt = "A cozy and warm coworking office with wooden desks, freelancers drinking coffee, plants, cozy ambient lighting, creative environment.";
            content = `## Workspace Cognitive Harmony\n\nTraditional cubicles are being replaced by flexible **coworking spaces**. Creative productivity flourishes when professionals are surrounded by collaboration rather than isolation. Here are the core metrics on focus levels in coworking environments...\n\n`;
        } else if (brand === "cr") {
            title = "The Art of Classic Car Restoration: Auto Paint & Dent Correction";
            keywords = "car restoration, auto body repair";
            prompt = "A vintage muscle car being restored in a modern garage, glossy finish, automotive tools, workshop spotlight.";
            content = `## Precision Car Restoration Craft\n\nAuto paint correction and systematic dent repair form the backbone of **car restoration**. In collision restoration, returning panels to factory spec requires high-grade sanders, custom primers, and digital spectrograph paint matches...\n\n`;
        }

        const newBlogObj = {
            id: newId,
            title: title,
            keywords: keywords,
            compiledContent: content,
            generatedImage: null,
            imageAspect: "16-9",
            imagePrompt: prompt,
            workflowState: "draft",
            bossName: "Mr. CEO / Project Director",
            recentImages: [],
            currentStep: 1,
            timelineHtml: "",
            timelineEmptyDisplay: "block"
        };

        this.state.blogs[brand].unshift(newBlogObj);
        this.state.activeBlogId[brand] = newId;

        this.loadBlogData(newBlogObj);
        this.renderLibraryList();

        if (!silent) {
            this.generateAIContent(true); // Load initial mock AI content for new title
            alert(`Created a new draft for ${brand.toUpperCase()} workspace!`);
        }
    }

    loadBlogData(blog) {
        this.state.blogId = blog.id;
        this.state.blogTitle = blog.title;
        this.state.keywords = blog.keywords;
        this.state.compiledContent = blog.compiledContent;
        this.state.generatedImage = blog.generatedImage;
        this.state.imageAspect = blog.imageAspect;
        this.state.imagePrompt = blog.imagePrompt;
        this.state.workflowState = blog.workflowState;
        this.state.bossName = blog.bossName || "Mr. CEO";
        this.state.recentImages = blog.recentImages || [];
        this.state.currentStep = blog.currentStep || 1;

        // Apply to DOM elements
        this.dom.titleInput.value = this.state.blogTitle;
        this.dom.keywordsInput.value = this.state.keywords;
        this.dom.compilerInput.value = this.state.compiledContent;
        this.dom.imagePrompt.value = this.state.imagePrompt;

        // Restore aspect ratio
        this.setAspect(this.state.imageAspect);

        // Restore cover image
        if (this.state.generatedImage) {
            this.dom.compiledBlogImage.src = this.state.generatedImage;
            this.dom.compiledBlogImage.classList.remove("hidden");
            const placeholder = this.dom.blogImageBox.querySelector(".placeholder-content");
            if (placeholder) placeholder.style.display = "none";
        } else {
            this.dom.compiledBlogImage.classList.add("hidden");
            const placeholder = this.dom.blogImageBox.querySelector(".placeholder-content");
            if (placeholder) placeholder.style.display = "flex";
        }

        // Restore gallery
        this.updateGalleryUI();

        // Restore timeline
        if (blog.timelineHtml) {
            this.dom.timeline.innerHTML = blog.timelineHtml;
            this.dom.timelineEmpty.style.display = blog.timelineEmptyDisplay || "none";
        } else {
            this.dom.timeline.innerHTML = "";
            this.dom.timelineEmpty.style.display = "block";
        }

        // Apply tone selectors
        this.updateStepUI();
        this.updateSEOMetrics();
        this.updateWorkflowUI();
        
        // Load initial comparison drafts corresponding to title
        this.generateAIContent(true);
    }

    saveActiveBlog() {
        const brand = this.state.activeBrand;
        const blogId = this.state.blogId;
        if (!blogId) return;

        const blogList = this.state.blogs[brand];
        const index = blogList.findIndex(b => b.id === blogId);
        if (index === -1) return;

        // Sync values to the list item
        blogList[index] = {
            id: blogId,
            title: this.state.blogTitle,
            keywords: this.state.keywords,
            compiledContent: this.state.compiledContent,
            generatedImage: this.state.generatedImage,
            imageAspect: this.state.imageAspect,
            imagePrompt: this.dom.imagePrompt.value,
            workflowState: this.state.workflowState,
            bossName: this.state.bossName,
            recentImages: this.state.recentImages,
            currentStep: this.state.currentStep,
            timelineHtml: this.dom.timeline.innerHTML,
            timelineEmptyDisplay: this.dom.timelineEmpty.style.display
        };

        // Write to localStorage
        localStorage.setItem(`fastblog_blogs_${brand}`, JSON.stringify(blogList));
        localStorage.setItem(`fastblog_active_id_${brand}`, blogId);
    }

    loadAppState() {
        const activeBrand = localStorage.getItem("fastblog_active_brand") || "allies";
        this.state.activeBrand = activeBrand;

        const brands = ["allies", "brandnook", "cr"];
        brands.forEach(b => {
            const savedBlogs = localStorage.getItem(`fastblog_blogs_${b}`);
            if (savedBlogs) {
                this.state.blogs[b] = JSON.parse(savedBlogs);
            } else {
                this.state.blogs[b] = [];
            }
            this.state.activeBlogId[b] = localStorage.getItem(`fastblog_active_id_${b}`);
        });

        // Restore sidebar width/height preferences
        const savedWide = localStorage.getItem("fastblog_sidebar_wide") === "true";
        if (savedWide && this.dom.workspaceContainer) {
            this.dom.workspaceContainer.classList.add("sidebar-wide");
            const btn = document.getElementById("sidebar-size-toggle");
            if (btn) btn.textContent = "↔ Narrow";
        }

        const savedFullHeight = localStorage.getItem("fastblog_sidebar_full_height") === "true";
        if (savedFullHeight && this.dom.workspaceContainer) {
            this.dom.workspaceContainer.classList.add("sidebar-full-height");
            const btn = document.getElementById("sidebar-height-toggle");
            if (btn) btn.textContent = "↕ Scroll View";
        }

        // Trigger load
        this.loadBrandWorkspace();
    }

    renderLibraryList() {
        const brand = this.state.activeBrand;
        const listContainer = this.dom.libraryBlogList;
        if (!listContainer) return;

        listContainer.innerHTML = "";
        let blogList = this.state.blogs[brand] || [];

        // Synchronize tab styles
        const filter = this.state.libraryFilter || "all";
        const allTab = document.getElementById("filter-all");
        const approvedTab = document.getElementById("filter-approved");
        if (allTab && approvedTab) {
            if (filter === "all") {
                allTab.classList.add("active");
                approvedTab.classList.remove("active");
            } else {
                allTab.classList.remove("active");
                approvedTab.classList.add("active");
            }
        }

        // Calculate and display count of approved blogs
        const approvedCount = blogList.filter(b => b.workflowState === "approved").length;
        if (approvedTab) {
            approvedTab.textContent = `Approved (${approvedCount})`;
        }

        // Apply filters
        if (filter === "approved") {
            blogList = blogList.filter(b => b.workflowState === "approved");
        }

        if (blogList.length === 0) {
            listContainer.innerHTML = `<div class="timeline-empty">No ${filter === "approved" ? "approved " : ""}drafts found</div>`;
            return;
        }

        blogList.forEach(blog => {
            const item = document.createElement("div");
            item.className = `library-item ${blog.id === this.state.blogId ? 'active' : ''}`;
            
            // Format state labels
            const states = {
                draft: "Draft",
                reviewing: "Reviewing",
                edits_requested: "Edits",
                approved: "Approved"
            };

            const wordCount = blog.compiledContent ? blog.compiledContent.trim().split(/\s+/).length : 0;

            item.innerHTML = `
                <div class="library-item-title">${blog.title || 'Untitled Blog'}</div>
                <div class="library-item-meta">
                    <span>${wordCount} words</span>
                    <span style="font-weight:600;color:var(--accent-primary)">${states[blog.workflowState]}</span>
                </div>
            `;

            item.onclick = () => {
                // Save current first
                this.saveActiveBlog();
                this.state.activeBlogId[brand] = blog.id;
                this.loadBlogData(blog);
                this.renderLibraryList();
            };

            listContainer.appendChild(item);
        });
    }

    setLibraryFilter(filter) {
        this.state.libraryFilter = filter || "all";
        this.renderLibraryList();
    }

    /* COLLAPSIBLE SIDEBARS & BOARDS */
    toggleSidebar() {
        this.state.sidebarCollapsed = !this.state.sidebarCollapsed;
        
        if (this.state.sidebarCollapsed) {
            this.dom.sidebar.style.display = "none";
            this.dom.expandSidebarBtn.classList.remove("hidden");
            this.dom.workspaceContainer.classList.add("sidebar-collapsed");
        } else {
            this.dom.sidebar.style.display = "flex";
            this.dom.expandSidebarBtn.classList.add("hidden");
            this.dom.workspaceContainer.classList.remove("sidebar-collapsed");
        }
    }

    toggleSidebarWidth() {
        const btn = document.getElementById("sidebar-size-toggle");
        const container = this.dom.workspaceContainer;
        if (!container || !btn) return;

        const isWide = container.classList.toggle("sidebar-wide");
        btn.textContent = isWide ? "↔ Narrow" : "↔ Wide";
        
        localStorage.setItem("fastblog_sidebar_wide", isWide);
    }

    toggleSidebarHeight() {
        const btn = document.getElementById("sidebar-height-toggle");
        const container = this.dom.workspaceContainer;
        if (!container || !btn) return;

        const isFullHeight = container.classList.toggle("sidebar-full-height");
        btn.textContent = isFullHeight ? "↕ Scroll View" : "↕ Full Height";
        
        localStorage.setItem("fastblog_sidebar_full_height", isFullHeight);
    }

    toggleBoard(model) {
        const board = document.getElementById(`board-${model}`);
        this.state.collapsedBoards[model] = !this.state.collapsedBoards[model];
        
        if (this.state.collapsedBoards[model]) {
            board.classList.add("collapsed");
        } else {
            board.classList.remove("collapsed");
        }
    }

    /* AI CONTENT GENERATOR SIMULATOR */
    changeTone(model, tone) {
        this.state.currentTone[model] = tone;
        this.generateSingleMock(model);
        this.saveActiveBlog();
    }

    regenerateModel(model) {
        const body = document.getElementById(`content-${model}`);
        body.innerHTML = `
            <div class="shimmer-loading">
                <div class="shimmer-line"></div>
                <div class="shimmer-line w-90"></div>
                <div class="shimmer-line w-80"></div>
                <div class="shimmer-line w-70"></div>
            </div>
        `;
        setTimeout(() => {
            this.generateSingleMock(model);
        }, 1200);
    }

    generateAIContent(silent = false) {
        if (!silent) {
            const buttons = document.querySelectorAll(".btn-generate svg");
            buttons.forEach(btn => btn.classList.add("spin"));
        }

        const models = ['chatgpt', 'claude', 'perplexity'];
        models.forEach(m => {
            const body = document.getElementById(`content-${m}`);
            body.innerHTML = `
                <div class="shimmer-loading">
                    <div class="shimmer-line"></div>
                    <div class="shimmer-line w-90"></div>
                    <div class="shimmer-line w-80"></div>
                    <div class="shimmer-line w-70"></div>
                </div>
            `;
        });

        setTimeout(() => {
            models.forEach(m => this.generateSingleMock(m));
            if (!silent) {
                const buttons = document.querySelectorAll(".btn-generate svg");
                buttons.forEach(btn => btn.classList.remove("spin"));
                if (this.state.currentStep < 2) {
                    this.setStep(2);
                }
            }
        }, 1300);
    }

    generateSingleMock(model) {
        const title = this.state.blogTitle || "Uncharted Horizons";
        const primaryKeyword = this.state.keywords.split(',')[0].trim() || "focus";
        const tone = this.state.currentTone[model];
        const brand = this.state.activeBrand;
        const body = document.getElementById(`content-${model}`);

        let content = "";
        
        // Brand Niche Content Matrix
        if (brand === "allies") {
            // Allies Commercial Realty Niche
            if (model === "chatgpt") {
                if (tone === "professional") {
                    content = `<h2>Structuring the Commercial Realty Portfolio</h2><p>To implement <strong>${primaryKeyword}</strong> effectively, real estate firms must analyze asset capitalization rates and hybrid usage density. ChatGPT proposes standardizing tenant lease options, ensuring a collaborative flex-office core that maintains property valuation metrics.</p><ul><li>Adapt space layouts for high-growth tenants</li><li>Incorporate ESG standard compliance</li><li>Optimize asset liquidity ratios</li></ul>`;
                } else if (tone === "conversational") {
                    content = `<h2>Unpacking Commercial Lease Shifts</h2><p>Have you looked at office lease rates lately? With <strong>${primaryKeyword}</strong>, commercial real estate isn't just about office space; it's about experiential working hubs. ChatGPT views this as a vital transition: giving tenants flexible spaces so they stay longer. Keep it collaborative, keep it smart!</p>`;
                } else {
                    content = `<h2>Asset Structuring</h2><p><strong>${primaryKeyword}</strong> demands property layout adaptation. Establish experiential spaces. Mitigate capital depreciation with lease elasticity.</p>`;
                }
            } else if (model === "claude") {
                if (tone === "professional") {
                    content = `<h2>A Spatial Curation Paradigm</h2><p>Claude approaches this commercial transition not merely as building management, but as the curation of commercial ecosystems. Through the lens of <strong>${primaryKeyword}</strong>, square footage becomes fluid infrastructure. Curation demands high aesthetic standards and shared amenities that attract top-tier tech startups.</p><p>Integrating coworking nodes inside larger corporate towers builds value.</p>`;
                } else if (tone === "conversational") {
                    content = `<h2>Ecosystems Over Offices</h2><p>Claude makes an excellent point: commercial spaces should feel alive, like communities. When writing about <strong>${primaryKeyword}</strong>, we should focus on property experience. Startups don't want bare walls; they want networking areas, green courtyards, and cafes. It's about property character.</p>`;
                } else {
                    content = `<h2>Spatial Harmony</h2><p>AI property optimization shifts focus from pure density to experiential design. <strong>${primaryKeyword}</strong> leverages multi-tenant hubs to maximize yield.</p>`;
                }
            } else if (model === "perplexity") {
                if (tone === "professional") {
                    content = `<h2>Data-Driven Realty Yields</h2><p>Perplexity's latest indexing reveals a massive rise in suburban flex-leasing. According to 2026 commercial realty indexes [1], property portfolios integrating <strong>${primaryKeyword}</strong> models reported a 15% increase in retention rates and 30% faster lease closures. Eco-leasing models are leading standard metrics [2].</p><p><em>Sources: [1] Commercial Real Estate Report, [2] Realty Trends Journal</em></p>`;
                } else if (tone === "conversational") {
                    content = `<h2>Real Estate stats you should know</h2><p>Perplexity has gathered the facts on <strong>${primaryKeyword}</strong>. Flex-office demands have grown by 22% this year alone. Properties that offer shared boardrooms and high-speed fibre lines command 1.4x higher rents per square meter. It's a massive market differentiator!</p>`;
                } else {
                    content = `<h2>Key Realty Metrics</h2><p><strong>${primaryKeyword}</strong>: 15% lease retention boost [1]. Flex-office demands command 1.4x higher rent yields across major metropolitan markets [2].</p>`;
                }
            }
        } else if (brand === "brandnook") {
            // Brandnook Coworking Niche
            if (model === "chatgpt") {
                if (tone === "professional") {
                    content = `<h2>Designing Coworking Ecosystems</h2><p>In hybrid environments, <strong>${primaryKeyword}</strong> requires specialized space zoning: silent libraries, phone booths, and collaborative lounges. ChatGPT advises structuring the community around structured weekly networking mixers to increase membership lifetime values.</p><ul><li>Incorporate smart access controls</li><li>Maximize desk usage density</li><li>Deliver superfast local networking infrastructure</li></ul>`;
                } else if (tone === "conversational") {
                    content = `<h2>Why Coworking Just Works</h2><p>Let's face it, working from home gets lonely. That's why coworking spaces with <strong>${primaryKeyword}</strong> are booming. It's about community. You get your work done, grab a coffee with a graphic designer at the next desk, and maybe secure your next big contract. It's a natural networking engine!</p>`;
                } else {
                    content = `<h2>Flexible Coworking</h2><p><strong>${primaryKeyword}</strong> relies on community interaction. Maximize shared desk rotations. Introduce weekly collaboration events.</p>`;
                }
            } else if (model === "claude") {
                if (tone === "professional") {
                    content = `<h2>The Symbiosis of Shared Spaces</h2><p>Claude views coworking spaces as cognitive incubators. Working under <strong>${primaryKeyword}</strong> guidelines allows freelancer communities to synthesize ideas organically. The coworking desk is not a commodity; it is a collaborative workspace where architectural design meets creative community culture.</p><p>This organic synthesis generates invaluable freelance output.</p>`;
                } else if (tone === "conversational") {
                    content = `<h2>The Creative Vibe of Coworking</h2><p>Claude describes coworking beautifully—it's like a workspace symphony. You have developers, writers, and painters all sharing one cozy room. The synergy is incredible. You feel inspired just walking in the door. Coworking turns the grind into a collaborative joy!</p>`;
                } else {
                    content = `<h2>Coconspiring Workspace</h2><p>Coworking transcends traditional offices. <strong>${primaryKeyword}</strong> links creative autonomy with workspace aesthetics, forging high-trust professional communities.</p>`;
                }
            } else if (model === "perplexity") {
                if (tone === "professional") {
                    content = `<h2>Shared Workspace Productivity Metrics</h2><p>Perplexity's latest search indexes show that hybrid workers in coworking hubs reported 45% more collaborative leads [1]. Studies on <strong>${primaryKeyword}</strong> confirm a 2.4x focus boost when freelancers transition from home offices to active, curated shared spaces [2].</p><p><em>Sources: [1] Future of Work Survey, [2] Creative Workspace Journal</em></p>`;
                } else if (tone === "conversational") {
                    content = `<h2>What the coworking data shows</h2><p>Perplexity has the facts on <strong>${primaryKeyword}</strong>. Over 70% of coworkers state they feel more productive since joining a shared hub. Networking yields average 3 new contracts per member annually. It's a verified growth driver for freelancers!</p>`;
                } else {
                    content = `<h2>Workspace Data Points</h2><p><strong>${primaryKeyword}</strong>: 45% higher lead generation [1], 2.4x focus boost. Coworking members secure 3 additional contracts annually via community referrals [2].</p>`;
                }
            }
        } else if (brand === "cr") {
            // CR Auto Collision Restoration Niche
            if (model === "chatgpt") {
                if (tone === "professional") {
                    content = `<h2>Collision Repair and Structural Integrity</h2><p>In standard auto body shop restoration, implementing <strong>${primaryKeyword}</strong> requires exact panel beating, aluminum welding, and alignment audits. ChatGPT recommends verifying frame metrics before paint runs. Safety compliance is critical to ensure vehicle safety ratings are restored.</p><ul><li>Apply computerized frame alignment</li><li>Utilize waterborne basecoat paint lines</li><li>Conduct structural strength checks</li></ul>`;
                } else if (tone === "conversational") {
                    content = `<h2>The Secrets to Auto Paint Correction</h2><p>Ever wonder how shops get that flawless mirror finish? Auto paint correction for <strong>${primaryKeyword}</strong> is about layers and patience. ChatGPT breaks it down: sand the clearcoat, buff out microscopic scratches, and apply premium ceramic coatings. It's pure restoration magic!</p>`;
                } else {
                    content = `<h2>Auto Body Refinishing</h2><p><strong>${primaryKeyword}</strong> demands precise alignment. Enforce paint color-matching spectrographs. Verify panel tolerances before final assembly.</p>`;
                }
            } else if (model === "claude") {
                if (tone === "professional") {
                    content = `<h2>The Craft of Mechanical Resurrection</h2><p>Claude approaches collision restoration as a form of metallic curation. Resurrecting automotive panels and <strong>${primaryKeyword}</strong> is where mechanical art meets industrial science. Restoring classic frame lines is a dialogue with mechanical history, restoring the soul of the vehicle.</p><p>Flawless panel fitting requires exceptional metal shaping and patience.</p>`;
                } else if (tone === "conversational") {
                    content = `<h2>Bringing Old Steel Back to Life</h2><p>Claude treats car restoration like sculpting metal. It's fascinating. When dealing with <strong>${primaryKeyword}</strong>, it's not just fixing dents; it's reforming curves that were crafted decades ago. The auto restorer is part mechanic, part artist. It's an incredible craft!</p>`;
                } else {
                    content = `<h2>Metallic Restoration</h2><p>Collision repair restores design history. <strong>${primaryKeyword}</strong> blends computerized alignment with metal-shaping artistry, guaranteeing factory-spec body tolerances.</p>`;
                }
            } else if (model === "perplexity") {
                if (tone === "professional") {
                    content = `<h2>Auto Refinishing Precision Index</h2><p>Perplexity's latest search indices confirm collision restoration shops using digital spectrographs show 99.4% paint-matching accuracy [1]. For <strong>${primaryKeyword}</strong> runs, classic car restorations showed an average valuation increase of 35% after custom panel work [2].</p><p><em>Sources: [1] Automotive Service Association, [2] Classic Car Market Guide</em></p>`;
                } else if (tone === "conversational") {
                    content = `<h2>Auto restoration facts you need</h2><p>Perplexity has the data on <strong>${primaryKeyword}</strong>. Auto collision centers with specialized aluminum tooling repair structural damage 40% faster. Computerized paint matching reduces paint wastage by 28%. It's a huge boost for body shop efficiency!</p>`;
                } else {
                    content = `<h2>Body Shop Restoration Metrics</h2><p><strong>${primaryKeyword}</strong>: 99.4% paint match accuracy [1], 35% valuation increase post-restoration. Computerized color-matching reduces paint resource waste by 28% [2].</p>`;
                }
            }
        }

        body.innerHTML = content;
    }

    /* COMPILER & TEXT EDITOR */
    insertToCompiler(model) {
        const body = document.getElementById(`content-${model}`);
        let htmlContent = body.innerHTML;
        
        let md = htmlContent
            .replace(/<h2>(.*?)<\/h2>/g, '\n\n## $1\n\n')
            .replace(/<h3>(.*?)<\/h3>/g, '\n\n### $1\n\n')
            .replace(/<p>(.*?)<\/p>/g, '$1\n\n')
            .replace(/<li>(.*?)<\/li>/g, '- $1\n')
            .replace(/<ul>/g, '\n')
            .replace(/<\/ul>/g, '\n')
            .replace(/<strong>(.*?)<\/strong>/g, '**$1**')
            .replace(/<em>(.*?)<\/em>/g, '*$1*')
            .replace(/<div class="shimmer-loading">.*?<\/div>/g, '')
            .trim();

        const currentVal = this.dom.compilerInput.value;
        const divider = currentVal.trim() !== "" ? "\n\n" : "";
        this.dom.compilerInput.value = currentVal + divider + md;
        
        this.onEditorInput();

        const panel = document.querySelector(".compiler-editor");
        panel.style.boxShadow = "0 0 20px rgba(99, 102, 241, 0.4)";
        setTimeout(() => {
            panel.style.boxShadow = "";
        }, 600);

        if (this.state.currentStep < 3) {
            this.setStep(3);
        }
    }

    formatText(action) {
        const textarea = this.dom.compilerInput;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = textarea.value;
        const selected = text.substring(start, end);

        let replacement = "";
        
        switch(action) {
            case "h2":
                replacement = `\n## ${selected || 'Subheading'}\n`;
                break;
            case "h3":
                replacement = `\n### ${selected || 'Minor Subheading'}\n`;
                break;
            case "bold":
                replacement = `**${selected || 'bold text'}**`;
                break;
            case "italic":
                replacement = `*${selected || 'italic text'}*`;
                break;
            case "quote":
                replacement = `\n> ${selected || 'Blockquote block'}\n`;
                break;
            case "list":
                replacement = `\n- ${selected || 'List item'}\n`;
                break;
        }

        textarea.value = text.substring(0, start) + replacement + text.substring(end);
        textarea.focus();
        textarea.setSelectionRange(start + replacement.length, start + replacement.length);
        this.onEditorInput();
    }

    clearEditor() {
        if (confirm("Are you sure you want to clear the editor?")) {
            this.dom.compilerInput.value = "";
            this.onEditorInput();
        }
    }

    onEditorInput() {
        this.state.compiledContent = this.dom.compilerInput.value;
        this.updateSEOMetrics();
        this.updateWorkflowProgress();
        this.saveActiveBlog();
        this.renderLibraryList(); // update word counts in list
    }

    updateSEOMetrics() {
        const text = this.state.compiledContent || "";
        const title = this.state.blogTitle || "";
        const keywordsInput = this.state.keywords || "";
        const keywords = keywordsInput.split(',').map(k => k.trim().toLowerCase()).filter(Boolean);

        // Word count
        const words = text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
        this.dom.wordCount.textContent = words;

        // Read time
        const readTime = Math.ceil(words / 200);
        this.dom.readTime.textContent = `${readTime}m`;

        // SEO checklist
        let score = 0;
        let checks = { title: false, firstpara: false, density: false, length: false, headings: false };

        if (keywords.length > 0) {
            const firstKw = keywords[0];
            
            // 1. Keyword in Title
            if (title.toLowerCase().includes(firstKw)) {
                checks.title = true;
                score += 20;
            }

            // 2. Keyword in First Paragraph
            const paras = text.split('\n').filter(p => p.trim() !== "");
            if (paras.length > 0 && paras[0].toLowerCase().includes(firstKw)) {
                checks.firstpara = true;
                score += 20;
            }

            // 3. Keyword density (target: 1-2.5%)
            if (words > 50) {
                const regex = new RegExp(`\\b${firstKw}\\b`, 'gi');
                const matches = text.match(regex);
                const count = matches ? matches.length : 0;
                const density = (count / words) * 100;
                
                if (density >= 1.0 && density <= 3.0) {
                    checks.density = true;
                    score += 20;
                }
            }

            // 4. Length (Min 300 words)
            if (words >= 300) {
                checks.length = true;
                score += 20;
            }

            // 5. Headings
            if (text.includes("## ") || text.includes("### ")) {
                checks.headings = true;
                score += 20;
            }
        }

        this.updateChecklistItem("seo-chk-title", checks.title);
        this.updateChecklistItem("seo-chk-firstpara", checks.firstpara);
        this.updateChecklistItem("seo-chk-density", checks.density);
        this.updateChecklistItem("seo-chk-length", checks.length);
        this.updateChecklistItem("seo-chk-headings", checks.headings);

        this.dom.seoScore.textContent = `${score}%`;
        this.dom.seoBar.style.width = `${score}%`;
    }

    updateChecklistItem(id, isChecked) {
        const el = document.getElementById(id);
        if (el) {
            if (isChecked) el.classList.add("checked");
            else el.classList.remove("checked");
        }
    }

    toggleSeoChecklist() {
        this.dom.seoDrawer = document.getElementById("seo-drawer");
        this.dom.seoDrawer.classList.toggle("hidden");
    }

    updateWorkflowProgress() {
        const words = parseInt(this.dom.wordCount.textContent) || 0;
        let progress = 10;

        if (words > 0) progress = 25;
        if (words > 100) progress = 50;
        if (words > 250) progress = 75;
        if (words >= 400 && this.state.generatedImage) progress = 90;
        if (this.state.workflowState === "approved") progress = 100;

        this.dom.progressBadge.textContent = `Progress: ${progress}%`;
    }

    /* DYNAMIC CANVAS ARTWORK GENERATOR */
    setAspect(aspect) {
        this.state.imageAspect = aspect;
        this.dom.blogImageBox.className = "preview-box";
        this.dom.blogImageBox.classList.add(`aspect-${aspect}`);

        const btns = document.querySelectorAll(".aspect-btn");
        btns.forEach(btn => {
            if (btn.textContent.trim() === aspect.replace('-', ':')) {
                btn.classList.add("active");
            } else {
                btn.classList.remove("active");
            }
        });
        
        if (this.state.generatedImage) {
            this.generateMockImage(true);
        }
        this.saveActiveBlog();
    }

    generateMockImage(redrawOnly = false) {
        if (!redrawOnly) {
            this.dom.imageSpinner.classList.remove("hidden");
            this.dom.compiledBlogImage.classList.add("hidden");
        }

        setTimeout(() => {
            const aspect = this.state.imageAspect;
            const brand = this.state.activeBrand;
            let width = 1200;
            let height = 675; // 16:9

            if (aspect === "1-1") {
                width = 800;
                height = 800;
            } else if (aspect === "4-5") {
                width = 800;
                height = 1000;
            }

            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");

            // 1. Draw Brand specific themed background gradients
            const bgGrad = ctx.createRadialGradient(width/2, height/2, 50, width/2, height/2, Math.max(width, height));
            if (brand === "allies") {
                // Navy / Gold gradient
                bgGrad.addColorStop(0, "#1d3257");
                bgGrad.addColorStop(1, "#070b14");
            } else if (brand === "brandnook") {
                // Cozy Amber / Terracotta
                bgGrad.addColorStop(0, "#4a2410");
                bgGrad.addColorStop(1, "#0e0804");
            } else {
                // Industrial Steel / Racing Red-Grey
                bgGrad.addColorStop(0, "#2c3340");
                bgGrad.addColorStop(1, "#0b0c0f");
            }
            ctx.fillStyle = bgGrad;
            ctx.fillRect(0, 0, width, height);

            // 2. Draw Grid
            ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
            ctx.lineWidth = 1;
            const gridSpacing = 40;
            for (let x = 0; x < width; x += gridSpacing) {
                ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
            }
            for (let y = 0; y < height; y += gridSpacing) {
                ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
            }

            // 3. Glowing core nodes based on theme
            ctx.fillStyle = brand === "allies" ? "rgba(184, 144, 71, 0.18)" : brand === "brandnook" ? "rgba(217, 119, 6, 0.18)" : "rgba(225, 29, 72, 0.18)";
            ctx.filter = "blur(50px)";
            ctx.beginPath();
            ctx.arc(width * 0.5, height * 0.5, width * 0.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.filter = "none";

            // 4. Abstract geometries
            ctx.lineWidth = 2;
            ctx.strokeStyle = brand === "allies" ? "rgba(184, 144, 71, 0.2)" : brand === "brandnook" ? "rgba(217, 119, 6, 0.2)" : "rgba(225, 29, 72, 0.2)";
            ctx.beginPath();
            ctx.arc(width/2, height/2, height * 0.3, 0, Math.PI * 2);
            ctx.stroke();

            // Brand specific watermark shapes
            ctx.fillStyle = brand === "allies" ? "#b89047" : brand === "brandnook" ? "#d97706" : "#e11d48";
            ctx.beginPath();
            if (brand === "allies") {
                // Realty pillars / Diamonds
                ctx.moveTo(width/2, height/2 - height*0.35);
                ctx.lineTo(width/2 + 20, height/2 - height*0.3);
                ctx.lineTo(width/2, height/2 - height*0.25);
                ctx.lineTo(width/2 - 20, height/2 - height*0.3);
            } else if (brand === "brandnook") {
                // Coworking concentric circles / dots
                ctx.arc(width/2, height/2 - height*0.3, 15, 0, Math.PI*2);
            } else {
                // Auto Restoration racing lines / triangles
                ctx.moveTo(width/2 - 25, height/2 - height*0.32);
                ctx.lineTo(width/2 + 25, height/2 - height*0.32);
                ctx.lineTo(width/2, height/2 - height*0.26);
            }
            ctx.fill();

            // 5. Title Text
            ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
            ctx.textAlign = "center";
            ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
            ctx.shadowBlur = 12;

            const fontSize = Math.max(22, Math.floor(width / 24));
            ctx.font = `800 ${fontSize}px 'Outfit', system-ui`;
            const titleText = this.state.blogTitle || "Creative Article Draft";
            this.drawWrappedText(ctx, titleText, width/2, height/2 - 10, width * 0.85, fontSize * 1.3);

            // 6. Footer label
            ctx.shadowBlur = 0;
            ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
            ctx.font = "600 11px 'Inter'";
            const brandNames = { allies: "ALLIES COMMERCIAL REALTY", brandnook: "BRANDNOOK COWORKING", cr: "AUTO COLLISION RESTORATION" };
            ctx.fillText(`${brandNames[brand]} // ARTICLES`, width/2, height - 30);

            const dataUrl = canvas.toDataURL("image/png");
            this.dom.compiledBlogImage.src = dataUrl;
            this.dom.compiledBlogImage.classList.remove("hidden");
            this.dom.imageSpinner.classList.add("hidden");

            const placeholder = this.dom.blogImageBox.querySelector(".placeholder-content");
            if (placeholder) placeholder.style.display = "none";

            this.state.generatedImage = dataUrl;

            if (!redrawOnly) {
                this.state.recentImages.unshift(dataUrl);
                if (this.state.recentImages.length > 3) this.state.recentImages.pop();
                this.updateGalleryUI();
                if (this.state.currentStep < 4) {
                    this.setStep(4);
                }
            }
            this.updateWorkflowProgress();
            this.saveActiveBlog();
        }, redrawOnly ? 0 : 1300);
    }

    drawWrappedText(ctx, text, x, y, maxWidth, lineHeight) {
        const words = text.split(" ");
        let line = "";
        let lines = [];

        for (let n = 0; n < words.length; n++) {
            let testLine = line + words[n] + " ";
            let metrics = ctx.measureText(testLine);
            let testWidth = metrics.width;
            if (testWidth > maxWidth && n > 0) {
                lines.push(line);
                line = words[n] + " ";
            } else {
                line = testLine;
            }
        }
        lines.push(line);

        let startY = y - ((lines.length - 1) * lineHeight) / 2;
        for (let i = 0; i < lines.length; i++) {
            ctx.fillText(lines[i], x, startY);
            startY += lineHeight;
        }
    }

    updateGalleryUI() {
        this.dom.mockGallery.classList.remove("hidden");
        this.dom.galleryGrid.innerHTML = "";
        this.state.recentImages.forEach((imgUrl, index) => {
            const card = document.createElement("div");
            card.className = "gallery-card";
            card.innerHTML = `<img src="${imgUrl}" alt="Concept Run ${index}">`;
            card.onclick = () => {
                this.dom.compiledBlogImage.src = imgUrl;
                this.state.generatedImage = imgUrl;
                this.saveActiveBlog();
            };
            this.dom.galleryGrid.appendChild(card);
        });
    }

    /* APPROVAL WORKFLOW STATE MACHINE */
    openShareModal() {
        const words = parseInt(this.dom.wordCount.textContent) || 0;
        const seo = this.dom.seoScore.textContent;
        
        this.dom.modalPreviewTitle.textContent = this.state.blogTitle;
        this.dom.modalPreviewMeta.textContent = `${words} words // SEO score: ${seo}`;
        
        if (this.state.generatedImage) {
            this.dom.modalPreviewImg.src = this.state.generatedImage;
            this.dom.modalPreviewImg.style.display = "block";
        } else {
            this.dom.modalPreviewImg.style.display = "none";
        }
        this.dom.shareModal.classList.remove("hidden");
    }

    closeShareModal() {
        this.dom.shareModal.classList.add("hidden");
    }

    sendToBoss() {
        this.state.bossName = document.getElementById("boss-name").value || "Mr. CEO";
        const message = document.getElementById("boss-instructions").value;
        this.closeShareModal();

        // Compile and Auto-Download the MS Word Document package immediately!
        this.exportBlog("word");

        this.state.workflowState = "reviewing";
        this.setStep(5);

        this.dom.timelineEmpty.style.display = "none";
        this.dom.timeline.innerHTML = `
            <div class="comment-card">
                <div class="comment-header">
                    <span class="comment-author" style="color:var(--accent-primary)">Author (You)</span>
                    <span class="comment-time">Just Now</span>
                </div>
                <div class="comment-body">
                    <strong>Submitted draft to ${this.state.bossName} for approval.</strong><br>
                    <span class="dim">"${message}"</span>
                    <div style="margin-top: 8px; font-weight: 600;">
                        📄 Attached: <a href="#" onclick="app.exportBlog('word'); return false;" style="color: var(--accent-primary); text-decoration: underline;">${this.state.blogTitle.slice(0, 30)}...doc</a>
                    </div>
                </div>
            </div>
        `;

        this.updateWorkflowUI();

        // Start delayed feedback sequence
        setTimeout(() => {
            this.triggerBossReviewFeedback();
        }, 3000);
        this.saveActiveBlog();
    }

    triggerBossReviewFeedback() {
        this.state.workflowState = "edits_requested";
        this.setStep(3);

        const comment = document.createElement("div");
        comment.className = "comment-card comment-requested";

        // Tailor comments to brand profile
        let feedbackText = "";
        const brand = this.state.activeBrand;
        if (brand === "allies") {
            feedbackText = `"I read the compiled doc. Excellent analysis on office zoning! However, can we expand the section on suburban flex-leasing trends to give it more weight? Please push word count above 250 words and resubmit."`;
        } else if (brand === "brandnook") {
            feedbackText = `"The coworking draft looks very warm and fits our coworking aesthetics. But we need to add more detail regarding freelancer productivity benefits. Please extend the compiled text and resubmit."`;
        } else {
            feedbackText = `"Classic car paint correction section is great. I need you to expand on the digital spectrograph color-matching details in auto restoration before I sign off. Get it past 250 words!"`;
        }

        comment.innerHTML = `
            <div class="comment-header">
                <span class="comment-author">${this.state.bossName}</span>
                <span class="comment-time">Just Now</span>
            </div>
            <div class="comment-body">
                ${feedbackText}
            </div>
        `;
        this.dom.timeline.insertBefore(comment, this.dom.timeline.firstChild);

        this.updateWorkflowUI();

        const editor = document.querySelector(".compiler-editor");
        editor.style.boxShadow = "0 0 20px rgba(245, 158, 11, 0.4)";
        setTimeout(() => { editor.style.boxShadow = ""; }, 1000);

        this.saveActiveBlog();
    }

    resubmitToBoss() {
        const words = parseInt(this.dom.wordCount.textContent) || 0;
        
        if (words < 250) {
            alert("Your boss requested to expand the blog content. Please write more in the compiler editor before resubmitting!");
            return;
        }

        // Auto-compile new Word Doc
        this.exportBlog("word");

        this.state.workflowState = "reviewing";
        this.setStep(5);

        const event = document.createElement("div");
        event.className = "comment-card";
        event.innerHTML = `
            <div class="comment-header">
                <span class="comment-author" style="color:var(--accent-primary)">Author (You)</span>
                <span class="comment-time">Just Now</span>
            </div>
            <div class="comment-body">
                <strong>Resubmitted updated draft (${words} words).</strong><br>
                📄 <a href="#" onclick="app.exportBlog('word'); return false;" style="color: var(--accent-primary); text-decoration: underline;">Updated_Draft.doc</a>
            </div>
        `;
        this.dom.timeline.insertBefore(event, this.dom.timeline.firstChild);
        this.updateWorkflowUI();

        setTimeout(() => {
            this.triggerBossFinalApproval();
        }, 3000);
        this.saveActiveBlog();
    }

    triggerBossFinalApproval() {
        this.state.workflowState = "approved";
        this.setStep(5);

        const comment = document.createElement("div");
        comment.className = "comment-card comment-approved";
        comment.innerHTML = `
            <div class="comment-header">
                <span class="comment-author" style="color:var(--color-success)">${this.state.bossName}</span>
                <span class="comment-time">Just Now</span>
            </div>
            <div class="comment-body">
                "Outstanding work! The updated segments address my requests perfectly. The MS Word document is compiled and ready for our blogs manager. Fully approved!"
            </div>
        `;
        this.dom.timeline.insertBefore(comment, this.dom.timeline.firstChild);

        this.updateWorkflowUI();
        this.saveActiveBlog();
        this.renderLibraryList(); // update badge states in lists
    }

    updateWorkflowUI() {
        const state = this.state.workflowState;
        
        if (state === "draft") {
            this.dom.statusDot.className = "status-dot status-draft";
            this.dom.statusText.textContent = "Draft Phase";
            this.dom.btnShareBoss.style.display = "inline-flex";
            this.dom.btnShareBoss.disabled = false;
            this.dom.btnShareBoss.textContent = "Send to Boss for Approval";
            this.dom.btnShareBoss.onclick = () => this.openShareModal();
            this.dom.exportActions.classList.add("hidden");
        } else if (state === "reviewing") {
            this.dom.statusDot.className = "status-dot status-pending";
            this.dom.statusText.textContent = "Reviewing Phase";
            this.dom.btnShareBoss.style.display = "inline-flex";
            this.dom.btnShareBoss.disabled = true;
            this.dom.btnShareBoss.textContent = "Awaiting Feedback...";
            this.dom.exportActions.classList.add("hidden");
        } else if (state === "edits_requested") {
            this.dom.statusDot.className = "status-dot status-draft";
            this.dom.statusText.textContent = "Edits Requested";
            this.dom.btnShareBoss.style.display = "inline-flex";
            this.dom.btnShareBoss.disabled = false;
            this.dom.btnShareBoss.textContent = "Resubmit Draft";
            this.dom.btnShareBoss.onclick = () => this.resubmitToBoss();
            this.dom.exportActions.classList.add("hidden");
        } else if (state === "approved") {
            this.dom.statusDot.className = "status-dot status-approved";
            this.dom.statusText.textContent = "Approved & Ready";
            this.dom.btnShareBoss.style.display = "none";
            this.dom.exportActions.classList.remove("hidden");
        }
        
        this.updateWorkflowProgress();
    }

    /* STEP PROGRESS NAVIGATION */
    setStep(stepNum) {
        this.state.currentStep = stepNum;
        this.updateStepUI();
        this.saveActiveBlog();
    }

    updateStepUI() {
        const steps = document.querySelectorAll(".step");
        const lines = document.querySelectorAll(".step-line");

        steps.forEach((step, index) => {
            const num = index + 1;
            step.className = "step";
            if (num === this.state.currentStep) {
                step.classList.add("active");
            } else if (num < this.state.currentStep) {
                step.classList.add("completed");
            }
        });

        lines.forEach((line, index) => {
            const num = index + 1;
            line.className = "step-line";
            if (num < this.state.currentStep) {
                line.classList.add("active");
            }
        });
    }

    /* SETTINGS MODAL */
    openSettings() {
        this.dom.settingsModal.classList.remove("hidden");
    }

    closeSettings() {
        this.dom.settingsModal.classList.add("hidden");
    }

    saveSettings() {
        this.state.apiSettings.openai = document.getElementById("setting-openai-key").value;
        this.state.apiSettings.anthropic = document.getElementById("setting-anthropic-key").value;
        this.state.apiSettings.perplexity = document.getElementById("setting-perplexity-key").value;
        
        this.closeSettings();
        alert("API settings saved to session storage.");
    }

    /* CLIENT-SIDE MULTI-FORMAT COMPILER & EXPORTER */
    exportBlog(format) {
        const title = this.state.blogTitle || "Untitled Draft";
        const text = this.state.compiledContent || "";
        const image = this.state.generatedImage || "";
        const brand = this.state.activeBrand;

        const brandNames = { allies: "Allies Commercial Realty", brandnook: "Brandnook Coworking", cr: "Auto Collision Restoration" };
        const brandUrls = { 
            allies: "https://alliescommercialrealty.com/blogs/", 
            brandnook: "https://brandnookcoworking.com/blogs/", 
            cr: "https://autocollisionrestoration.com/blogs/" 
        };

        let exportData = "";
        let filename = `${brand}_${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
        let mimeType = "text/plain";

        if (format === "markdown") {
            mimeType = "text/markdown";
            filename += ".md";
            exportData = `# ${title}\n\n`;
            exportData += `**Brand:** ${brandNames[brand]} (${brandUrls[brand]})\n\n`;
            if (image) {
                exportData += `![Featured Cover](${image})\n\n`;
            }
            exportData += text;
        } else if (format === "html") {
            mimeType = "text/html";
            filename += ".html";
            exportData = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>${title}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; line-height: 1.6; color: #333; }
        img { width: 100%; height: auto; border-radius: 8px; margin-bottom: 24px; }
        h1 { font-size: 2.5em; border-bottom: 1px solid #eee; padding-bottom: 12px; margin-bottom: 24px; color: #111827; }
        h2 { font-size: 1.75em; margin-top: 36px; margin-bottom: 16px; color: #1f2937; }
        .meta-bar { font-size: 0.9em; color: #6b7280; border-bottom: 1px dashed #eee; padding-bottom: 12px; margin-bottom: 24px; }
        p { margin-bottom: 16px; font-size: 16px; color: #374151; }
    </style>
</head>
<body>
    <h1>${title}</h1>
    <div class="meta-bar">
        <strong>Brand:</strong> <a href="${brandUrls[brand]}" target="_blank">${brandNames[brand]}</a> | 
        <strong>Target Keywords:</strong> ${this.state.keywords}
    </div>
    ${image ? `<img src="${image}" alt="Featured Cover Image">` : ""}
    ${text.split("\n\n").map(para => {
        if (para.startsWith("## ")) {
            return `<h2>${para.replace("## ", "")}</h2>`;
        } else if (para.startsWith("### ")) {
            return `<h3>${para.replace("### ", "")}</h3>`;
        } else if (para.trim() !== "") {
            return `<p>${para.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\*(.*?)\*/g, "<em>$1</em>")}</p>`;
        }
        return "";
    }).join("\n")}
</body>
</html>`;
        } else if (format === "word" || format === "doc") {
            mimeType = "application/msword";
            filename += ".doc";

            // Format bodies into MS Word styled tags
            let docBody = text.split("\n\n").map(para => {
                if (para.startsWith("## ")) {
                    return `<h2>${para.replace("## ", "")}</h2>`;
                } else if (para.startsWith("### ")) {
                    return `<h3>${para.replace("### ", "")}</h3>`;
                } else if (para.startsWith("- ")) {
                    return `<ul>${para.split("\n").map(li => `<li>${li.replace("- ", "")}</li>`).join("")}</ul>`;
                } else if (para.trim() !== "") {
                    return `<p>${para.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\*(.*?)\*/g, "<em>$1</em>")}</p>`;
                }
                return "";
            }).join("\n");

            // Compile into MS Word compatible HTML envelope (Base64 embedded image works offline!)
            exportData = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
    <meta charset="utf-8">
    <title>${title}</title>
    <!--[if gte mso 9]>
    <xml>
        <w:WordDocument>
            <w:View>Print</w:View>
            <w:Zoom>100</w:Zoom>
            <w:DoNotOptimizeForBrowser/>
        </w:WordDocument>
    </xml>
    <![endif]-->
    <style>
        body { font-family: "Calibri", sans-serif; font-size: 11pt; line-height: 1.4; margin: 1in; color: #2b2b2b; }
        h1 { font-family: "Georgia", serif; font-size: 26pt; color: #1f2937; margin-bottom: 6pt; border-bottom: 2px solid #b89047; padding-bottom: 8px; }
        h2 { font-family: "Georgia", serif; font-size: 16pt; color: #2b579a; margin-top: 24pt; margin-bottom: 8pt; }
        h3 { font-family: "Georgia", serif; font-size: 13pt; color: #4b5563; margin-top: 16pt; margin-bottom: 6pt; }
        p { margin-bottom: 8pt; text-align: justify; }
        .metadata-section { font-size: 9pt; color: #7f8c8d; margin-bottom: 24pt; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px; }
        img { width: 6.5in; max-width: 100%; height: auto; border-radius: 4px; margin-bottom: 20pt; }
        ul { margin-bottom: 8pt; padding-left: 20pt; }
        li { margin-bottom: 4pt; }
    </style>
</head>
<body>
    <h1>${title}</h1>
    <div class="metadata-section">
        <strong>Brand Workspace:</strong> ${brandNames[brand]} (${brandUrls[brand]})<br>
        <strong>Target SEO Keywords:</strong> ${this.state.keywords}<br>
        <strong>Generated via FastBlog:</strong> ${new Date().toLocaleDateString()}
    </div>
    ${image ? `<img src="${image}" alt="Featured cover art"><br><br>` : ""}
    ${docBody}
</body>
</html>`;
        }

        const blob = new Blob(["\ufeff" + exportData], { type: mimeType });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
}

// Instantiate and expose globally
const app = new FastBlogApp();
window.app = app;
document.addEventListener("DOMContentLoaded", () => app.init());
