import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import StoaSite from './StoaSite'

// stoacap.com/version1: the "Stoa" prototype from Magic Patterns,
// served beside the live home. Access requests are stored through the real
// /api/request, and sign-in opens the real /signin page.
const root = document.getElementById('root')
if (root) ReactDOM.createRoot(root).render(<StoaSite live />)
