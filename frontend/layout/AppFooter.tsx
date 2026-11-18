/* eslint-disable @next/next/no-img-element */

import React, { useContext } from 'react';
import { LayoutContext } from './context/layoutcontext';

const AppFooter = () => {
    const { layoutConfig } = useContext(LayoutContext);

    return (
        <div className="layout-footer">
            <span className="font-medium ml-2">Saúde e Vida · Sistema de gestão personalizado</span>
        </div>
    );
};

export default AppFooter;
