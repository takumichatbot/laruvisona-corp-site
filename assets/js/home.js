document.addEventListener('DOMContentLoaded', () => {
    // 1. Vanta.js (3D Background)
    // エフェクト設定：3D地球儀
    if (typeof VANTA !== 'undefined') {
        VANTA.GLOBE({
            el: "#hero-section",
            mouseControls: true,
            touchControls: true,
            gyroControls: false,
            minHeight: 200.00,
            minWidth: 200.00,
            scale: 1.00,
            scaleMobile: 1.00,
            color: 0x3b82f6,       // メインカラー（青）
            backgroundColor: 0x0f172a // 背景色（ダークスレート）
        });
    }

    // 2. GSAP ScrollTrigger アニメーション
    if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
        gsap.registerPlugin(ScrollTrigger);

        // ヒーローセクションの初期出現アニメーション
        gsap.to(".gsap-hero-elem", {
            opacity: 1,
            y: 0,
            duration: 1,
            stagger: 0.2, // 0.2秒ずつずらして出現
            ease: "power3.out",
            delay: 0.5
        });

        // スクロール時のフェードアップアニメーション
        gsap.utils.toArray(".gsap-fade-up").forEach(target => {
            gsap.from(target, {
                scrollTrigger: {
                    trigger: target,
                    start: "top 85%", // 画面の85%の位置に来たら発火
                    toggleActions: "play none none reverse"
                },
                opacity: 0,
                y: 30,
                duration: 0.8,
                ease: "power3.out"
            });
        });

        // 開発プロセスの横スクロールアニメーション
        const processContainer = document.querySelector(".process-container");
        if (processContainer) {
            const wrapper = document.querySelector(".process-wrapper");
            // 横幅の計算
            const scrollWidth = processContainer.scrollWidth - document.documentElement.clientWidth;
            
            gsap.to(processContainer, {
                x: -scrollWidth, // 左へ移動
                ease: "none",
                scrollTrigger: {
                    trigger: wrapper,
                    start: "top top",
                    end: `+=${scrollWidth + 1000}`, // スクロール量に応じて調整
                    scrub: 1, // スクロールに追従（1秒の遅延で滑らかに）
                    pin: true, // 画面を固定
                    anticipatePin: 1
                }
            });
        }
    }

    // 3. タイプライター風テキストエフェクト
    const TxtType = function(el, toRotate, period) {
        this.toRotate = toRotate;
        this.el = el;
        this.loopNum = 0;
        this.period = parseInt(period, 10) || 2000;
        this.txt = '';
        this.tick();
        this.isDeleting = false;
    };

    TxtType.prototype.tick = function() {
        var i = this.loopNum % this.toRotate.length;
        var fullTxt = this.toRotate[i];

        if (this.isDeleting) {
            this.txt = fullTxt.substring(0, this.txt.length - 1);
        } else {
            this.txt = fullTxt.substring(0, this.txt.length + 1);
        }

        this.el.innerHTML = '<span class="wrap">'+this.txt+'</span>';

        var that = this;
        var delta = 200 - Math.random() * 100;

        if (this.isDeleting) { delta /= 2; }

        if (!this.isDeleting && this.txt === fullTxt) {
            delta = this.period;
            this.isDeleting = true;
        } else if (this.isDeleting && this.txt === '') {
            this.isDeleting = false;
            this.loopNum++;
            delta = 500;
        }

        setTimeout(function() {
            that.tick();
        }, delta);
    };

    document.querySelectorAll('.typewrite').forEach(el => {
        var toRotate = el.getAttribute('data-type');
        var period = el.getAttribute('data-period');
        if (toRotate) {
            new TxtType(el, JSON.parse(toRotate), period);
        }
    });
});