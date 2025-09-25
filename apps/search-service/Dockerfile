# Usar una imagen oficial de Node.js como imagen padre
FROM node:18-alpine

# Establecer el directorio de trabajo en el contenedor
WORKDIR /usr/src/app

# Copiar package.json y package-lock.json (si está disponible)
COPY package*.json ./

# Instalar las dependencias de la aplicación
# Usamos --force para evitar problemas con versiones de dependencias en el monorepo
RUN npm install --force

# Copiar el código fuente de la aplicación
COPY . .

# Hacer que el puerto 3001 esté disponible fuera de este contenedor
EXPOSE 3001

# Comando para ejecutar la aplicación en modo de desarrollo
CMD ["npm", "run", "dev"]
