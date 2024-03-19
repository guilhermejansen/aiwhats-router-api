# Especifica a imagem base do Node.js
FROM node:21

# Define o diretório de trabalho dentro do container
WORKDIR /usr/src/app

# Copia os arquivos package.json e package-lock.json (ou yarn.lock)
COPY package*.json ./

# Instala as dependências da aplicação
RUN npm install

# Copia os arquivos e diretórios restantes para o diretório de trabalho dentro do container
COPY . .

# Expõe a porta que a aplicação utiliza
EXPOSE 5000

# Define o comando para rodar a aplicação
CMD ["node", "app.js"]

