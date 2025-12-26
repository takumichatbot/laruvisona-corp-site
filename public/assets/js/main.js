document.addEventListener('DOMContentLoaded', () => {
    // 1. Lenis Smooth Scroll (慣性スクロール)
    const lenis = new Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        direction: 'vertical',
        smooth: true,
    });
    function raf(time) {
        lenis.raf(time);
        requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    // 2. カスタムカーソル
    const cursor = document.getElementById('cursor');
    const follower = document.getElementById('cursor-follower');
    if(cursor && follower) {
        let posX = 0, posY = 0, mouseX = 0, mouseY = 0;

        // 滑らかな追従計算
        setInterval(() => {
            posX += (mouseX - posX) / 9;
            posY += (mouseY - posY) / 9;
            follower.style.left = posX + 'px';
            follower.style.top = posY + 'px';
            cursor.style.left = mouseX + 'px';
            cursor.style.top = mouseY + 'px';
        }, 16);

        document.addEventListener('mousemove', (e) => {
            mouseX = e.clientX;
            mouseY = e.clientY;
        });
    }

    // 3. マグネットボタン効果
    document.querySelectorAll('.magnet-button').forEach(btn => {
        btn.addEventListener('mousemove', (e) => {
            const rect = btn.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;
            btn.style.transform = `translate(${x * 0.3}px, ${y * 0.3}px)`;
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.transform = 'translate(0, 0)';
        });
    });

    // 4. ヘッダーのスクロール制御
    const header = document.getElementById('header');
    if(header) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                header.classList.add('py-2');
                header.classList.remove('py-4');
            } else {
                header.classList.add('py-4');
                header.classList.remove('py-2');
            }
        });
    }
});