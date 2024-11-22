class GameWS extends HTMLElement {
    constructor() {
        super()
        this.shadow = this.attachShadow({ mode: 'open' })
        this.view = "game-view-disconnected"
    }

    async connectedCallback() {
        // Carrega els estils CSS
        const style = document.createElement('style')
        style.textContent = await fetch('/shadows/game-ws/style.css').then(r => r.text())
        this.shadow.appendChild(style)
    
        // Carrega els elements HTML
        const htmlContent = await fetch('/shadows/game-ws/view.html').then(r => r.text())

        // Converteix la cadena HTML en nodes utilitzant un DocumentFragment
        const template = document.createElement('template');
        template.innerHTML = htmlContent;
        
        // Clona i afegeix el contingut del template al shadow
        this.shadow.appendChild(template.content.cloneNode(true));
    } 

    getViewShadow (viewName) {
        return this.shadow.querySelector(viewName)
    }

    getViewRoot (viewName) {
        return this.shadow.querySelector(viewName).shadowRoot.querySelector('.root')
    }

    async showView (viewName) {
        // Amagar totes les vistes
        let animTime = '500ms';
        let refDisconnected = this.getViewRoot('game-view-disconnected')
        let refConnecting = this.getViewRoot('game-view-connecting')
        let refDisconnecting = this.getViewRoot('game-view-disconnecting')
        let refPlaying = this.getViewRoot('game-view-playing')

        // Mostrar la vista seleccionada, amb l'status indicat
        switch (viewName) {
        case 'game-view-disconnected':
            if (this.view == 'game-view-connecting') {
                this.animateViewChange('right', animTime, refConnecting, refDisconnected)
            }
            if (this.view == 'game-view-disconnecting') {
                this.animateViewChange('right', animTime, refDisconnecting, refDisconnected)
            }
            break
        case 'game-view-connecting':
            this.animateViewChange('left', animTime, refDisconnected, refConnecting)
            break
        case 'game-view-disconnecting':
            this.animateViewChange('right', animTime, refPlaying, refDisconnecting)
            break
        case 'game-view-playing':
            this.animateViewChange('left', animTime, refConnecting, refPlaying)
            break
        }
        this.view = viewName
    }

    async animateViewChange (type, animTime, view0, view1) {
        if (type == 'right') {
            await Promise.all([
                this.animateElement(view0, animTime, "translate3d(0, 0, 0)", "translate3d(100%, 0, 0)"),
                this.animateElement(view1, animTime, "translate3d(-100%, 0, 0)", "translate3d(0%, 0, 0)")
            ])
        } else {
            await Promise.all([
                this.animateElement(view0, animTime, "translate3d(0, 0, 0)", "translate3d(-100%, 0, 0)"),
                this.animateElement(view1, animTime, "translate3d(100%, 0, 0)", "translate3d(0%, 0, 0)")
            ])
        }
    }

    async animateElement(element, animTime, posBegin, posEnd) {
        element.style.display = 'flex';
        element.style.transition = 'none';
    
        element.style.transform = posBegin;
    
        // Add small delay to ensure element is positioned before animating
        setTimeout(() => {
            let transition = 'transform ' + animTime + ' ease 0s';
            element.style.transition = transition;
            element.style.transform = posEnd;
        }, 100);
    }
}

// Defineix l'element personalitzat
customElements.define('game-ws', GameWS)