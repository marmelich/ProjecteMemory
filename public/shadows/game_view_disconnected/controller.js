class GameViewDisconnected extends HTMLElement {
    constructor() {
        super()
        this.shadow = this.attachShadow({ mode: 'open' })
    }

    async connectedCallback() {
        // Carrega els estils CSS
        const style = document.createElement('style')
        style.textContent = await fetch('/shadows/game_view_disconnected/style.css').then(r => r.text())
        this.shadow.appendChild(style)
    
        // Carrega els elements HTML
        const htmlContent = await fetch('/shadows/game_view_disconnected/view.html').then(r => r.text())

        // Converteix la cadena HTML en nodes utilitzant un DocumentFragment
        const template = document.createElement('template')
        template.innerHTML = htmlContent
        
        // Clona i afegeix el contingut del template al shadow
        this.shadow.appendChild(template.content.cloneNode(true))

        // Definir els 'eventListeners' dels objectes
        this.shadow.querySelector('#buttonConnect').addEventListener('click', this.actionConnect.bind(this))
    } 

    // Intentar connectar amb el servidor
    async actionConnect() {
        let server = this.shadow.querySelector('#server').value
        let port = this.shadow.querySelector('#port').value

        connect('ws', server, port)

        document.querySelector('game-ws').showView('game-view-connecting')
        
        await new Promise(resolve => setTimeout(resolve, 1500))

        if (socketConnected) {
            document.querySelector('game-ws').showView('game-view-playing')
        } else {
            document.querySelector('game-ws').showView('game-view-disconnected')
        }
    }
}

// Defineix l'element personalitzat
customElements.define('game-view-disconnected', GameViewDisconnected)